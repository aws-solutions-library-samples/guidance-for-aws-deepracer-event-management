#!/usr/bin/python3
# encoding=utf-8
import decimal
import json
import os
import uuid
from statistics import mean

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Attr, Key

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

LAPS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)

RACE_LAP_TYPE = "lap"
RACE_SUMMARY_TYPE = "race_summary"

EVENT_BUS_NAME = os.environ["EVENT_BUS_NAME"]
cloudwatch_events = boto3.client("events")

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


####################
# Admin methods
####################
@app.resolver(type_name="Query", field_name="getRacesForUser")
def getRacesForUser(eventId, userId):
    logger.info("getRacesForUser start")
    response = ddbTable.query(
        KeyConditionExpression=Key("pk").eq(f"RACE#{eventId}")
        & Key("sk").begins_with(userId)
    )
    logger.info(f"ddb query response: {response}")
    listOfRacesForUser = dbEntriesToRaceList(response["Items"])
    return listOfRacesForUser


# TODO update to make use of race summary and publishing to eventbridge raceSummaryUpdated
@app.resolver(type_name="Mutation", field_name="deleteRaceForUser")
def deleteRaceForUser(eventId, userId, raceId):
    response = ddbTable.query(
        KeyConditionExpression=Key("pk").eq(f"RACE#{eventId}")
        & Key("sk").begins_with(f"{userId}#{raceId}#")
    )
    items_to_delete = response["Items"]

    with ddbTable.batch_writer() as batch:
        laps = []
        for item in items_to_delete:
            response = batch.delete_item(
                Key={"pk": f"RACE#{eventId}", "sk": item["sk"]}
            )
            logger.info(response)
            lapId = item["sk"].rsplit("#", 1)[1]
            laps.append({"lapId": lapId})

    # TODO check if RECORD for user shall be updated
    return {"id": raceId, "laps": laps}


@app.resolver(type_name="Mutation", field_name="deleteLapForUser")
def deleteLapForUser(eventId, userId, raceId, lapId):
    ddbTable.delete_item(
        Key={"pk": f"RACE#{eventId}", "sk": f"{userId}#{raceId}#{lapId}"}
    )

    # TODO Check if RECORD for user shall be updated
    # TODO get all remaining lap times for user and distil current record time
    # TODO get record for user and compare if it shall be updated

    return {"raceId": raceId, "lapId": lapId}


####################
# Time keeper methods
####################
@app.resolver(type_name="Mutation", field_name="addRace")
def addRace(eventId, userId, username, laps, trackId=1):
    raceId = str(uuid.uuid4())
    print(laps)
    logger.info(laps)

    __store_laps(eventId, userId, raceId, laps)
    race_summary = __calculate_race_summary(eventId, userId)

    event_info = {
        "eventId": eventId,
        "username": username,
        "trackId": trackId,
        "userId": userId,
        "raceId": raceId,
    }

    race_summary_combined = __replace_decimal_with_float({**event_info, **race_summary})

    evbEvent = {
        "Detail": json.dumps(race_summary_combined),
        "DetailType": "raceSummaryAdded",
        "Source": "race-manager",
        "EventBusName": EVENT_BUS_NAME,
    }
    __put_evb_events([evbEvent])

    return {"id": raceId}


def __store_laps(event_id: str, user_id: str, race_id: str, laps: list) -> None:
    with ddbTable.batch_writer() as batch:
        # write laps to ddb
        for lap in laps:
            logger.info(lap)

            lapId = lap["id"]
            item = {
                **{
                    "eventId": event_id,
                    "sk": f"{user_id}#{race_id}#{lapId}",
                    "type": RACE_LAP_TYPE,
                    "userId": user_id,
                    "raceId": race_id,
                },
                **__replace_floats_with_decimal(lap),
            }
            logger.info(item)
            response = batch.put_item(Item=item)
            logger.info(f"ddb put lap resp: {response}")


def __store_race_summary(
    event_id: str, user_id: str, race_id: str, race_summary: dict
) -> None:
    # Write summary to ddb
    item = {
        "eventId": event_id,
        "sk": f"{user_id}#{race_id}",
        "type": RACE_SUMMARY_TYPE,
        "userId": user_id,
        "raceId": race_id,
        **__replace_floats_with_decimal(race_summary),
    }
    response = ddbTable.put_item(Item=item)
    logger.info(f"ddb put race summary resp: {response}")


def __calculate_race_summary(event_id, user_id) -> dict:

    stored_laps = __get_laps_by_event_id_and_user_id(event_id, user_id)
    valid_laps, invalid_laps = __get_laps_by_validity(stored_laps)
    avg_laps_per_attempt = __calculate_avg_laps_per_attempt(stored_laps)
    valid_lap_times = __get_valid_lap_times(stored_laps)

    summary = {
        "numberOfValidLaps": len(valid_laps),
        "numberOfInvalidLaps": len(invalid_laps),
        "fastestLapTime": min(valid_lap_times),
        "avgLapTime": mean(valid_lap_times),
        "lapCompletionRatio": round(float(len(valid_laps) / len(stored_laps)), 1)
        * 100,  # percentage
        "avgLapsPerAttempt": avg_laps_per_attempt,
    }
    logger.info(summary)
    return summary


def __get_laps_by_validity(laps: list) -> tuple[list, list]:
    valid_laps = []
    invalid_laps = []
    for lap in laps:
        if bool(lap["isValid"]):
            valid_laps.append(lap)
        else:
            invalid_laps.append(lap)
    return valid_laps, invalid_laps


def __get_valid_lap_times(laps: list) -> list:
    if len(laps) > 0:
        times = [x["time"] for x in laps]
        logger.info(times)
        return times
    else:
        return None


# def __calculate_fastest_lap_time(laps: list) -> float:
#     if len(laps) > 0:
#         times = [x["time"] for x in laps]
#         logger.info(times)
#         return min(times)
#     else:
#         return None


# def __calculate_avg_lap_time(laps: list) -> float:
#     if len(laps) > 0:
#         times = [x["time"] for x in laps]
#         return mean(times)
#     else:
#         return None


def __calculate_avg_laps_per_attempt(laps: int) -> float:
    number_of_laps_per_race = __calculate_number_of_laps_per_race(laps)

    total_number_of_races = len(number_of_laps_per_race)
    total_number_of_laps = sum(number_of_laps_per_race.values())

    avg_laps_per_attempt = round(float(total_number_of_laps / total_number_of_races), 2)
    logger.info(
        f"avg_laps_per_attempt: {avg_laps_per_attempt} = total_number_of_laps:"
        f" {total_number_of_laps} / total_number_of_races: {total_number_of_races}"
    )
    return avg_laps_per_attempt


def __calculate_number_of_laps_per_race(laps: list) -> dict:
    logger.info(laps)
    number_of_laps_per_race = {}
    for lap in laps:
        race_id = lap["raceId"]
        logger.info(f"race_id={race_id}")
        if race_id in number_of_laps_per_race:
            logger.info(f"race_id: {race_id} found in number_of_laps_per_race")
            logger.info(number_of_laps_per_race)
            number_of_laps_per_race[race_id] = number_of_laps_per_race[race_id] + 1
        else:
            logger.info(f"race_id: {race_id} NOT found in number_of_laps_per_race")
            logger.info(number_of_laps_per_race)
            number_of_laps_per_race[race_id] = 1
    logger.info(number_of_laps_per_race)
    return number_of_laps_per_race


def __get_laps_by_event_id_and_user_id(event_id: str, user_id: str) -> list:
    logger.info(f"eventId={event_id}, userId={user_id}")
    response = ddbTable.query(
        KeyConditionExpression=Key("eventId").eq(event_id)
        & Key("sk").begins_with(user_id),
        FilterExpression=Attr("type").eq(RACE_LAP_TYPE),
    )
    logger.info(response)
    return __replace_decimal_with_float(response["Items"])


def __put_evb_events(evbEvents: list) -> dict:
    return cloudwatch_events.put_events(Entries=evbEvents)


@app.resolver(type_name="Query", field_name="getAllRacers")
def getAllRacers():
    return __get_racers()


##################
# Helper functions
##################
def __get_racers():
    paginator = client_cognito.get_paginator("list_users")
    response_iterator = paginator.paginate(
        UserPoolId=user_pool_id,
        PaginationConfig={
            "PageSize": 60,
        },
    )

    # TODO the parts below can be optimized
    users = []
    for r in response_iterator:
        users.append(r["Users"])

    # Squash the list of lists
    all_users = [item for sublist in users for item in sublist]

    list_user_objects = []
    for user in all_users:
        user_object = {"username": user["Username"]}
        for attribute in user["Attributes"]:
            if attribute["Name"] == "sub":
                user_object["id"] = attribute["Value"]
        list_user_objects.append(user_object)

    logger.info(list_user_objects)
    return list_user_objects


def dbEntriesToRaceList(dbEntries):
    lapsPerRace = {}
    for dbEntry in dbEntries:
        userId = dbEntry["sk"].split("#")[0]
        raceId = dbEntry["sk"].split("#")[1]
        lapId = dbEntry["sk"].split("#")[2]
        dbEntry["lapId"] = lapId

        if raceId in lapsPerRace:
            lapsPerRace[raceId]["laps"].append(dbEntry)
        else:
            lapsPerRace[raceId] = {
                "id": raceId,
                "userId": userId,
                "laps": [dbEntry],
            }
    logger.info(f"lapsPerRace: {lapsPerRace}")

    return list(lapsPerRace.values())


def __replace_floats_with_decimal(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = __replace_floats_with_decimal(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = __replace_floats_with_decimal(obj[k])
        return obj
    elif isinstance(obj, float):
        return decimal.Decimal(obj).quantize(
            decimal.Decimal(".0001"), rounding=decimal.ROUND_DOWN
        )
    else:
        return obj


def __replace_decimal_with_float(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = __replace_decimal_with_float(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = __replace_decimal_with_float(obj[k])
        return obj
    elif isinstance(obj, decimal.Decimal):
        return float(obj)
    else:
        return obj
