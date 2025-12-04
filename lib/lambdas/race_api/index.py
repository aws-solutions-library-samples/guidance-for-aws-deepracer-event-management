#!/usr/bin/python3
# encoding=utf-8
import json
import os
import uuid
from datetime import datetime
from functools import reduce
from statistics import mean

import boto3
import dynamo_helpers
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

LAPS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)

RACE_LAP_TYPE = "lap"
RACE_TYPE = "race"
RACE_SUMMARY_TYPE = "race_summary"

EVENT_BUS_NAME = os.environ["EVENT_BUS_NAME"]
cloudwatch_events = boto3.client("events")


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getRaces")
def getRaces(eventId):
    response = {}

    response = ddbTable.query(
        KeyConditionExpression=Key("eventId").eq(eventId),
        FilterExpression=Attr("type").eq(RACE_TYPE),
    )

    race_object_list = response["Items"]
    logger.info(race_object_list)
    return race_object_list


@app.resolver(type_name="Mutation", field_name="deleteRaces")
def deleteRaces(eventId, racesToDelete):
    event_id = eventId
    user_ids_to_publish_events_for = []
    deleted_race_ids = []
    with ddbTable.batch_writer() as batch:
        for race in racesToDelete:
            user_id = race["userId"]
            race_id = race["raceId"]
            track_id = race["trackId"]
            sort_key = __generate_sort_key(track_id, user_id, race_id)
            try:
                response = batch.delete_item(Key={"eventId": event_id, "sk": sort_key})
                logger.info(response)
                # TODO add error handling if any of the items can´t be removed
                deleted_race_ids.append(race_id)
                if user_id not in user_ids_to_publish_events_for:
                    user_ids_to_publish_events_for.append(user_id)
            except ClientError as error:
                logger.error(
                    "Couldn't delete race %s. Here's why: %s: %s",
                    race_id,
                    error.response["Error"]["Code"],
                    error.response["Error"]["Message"],
                )

    logger.info(user_ids_to_publish_events_for)

    # TODO send one event per userId
    for user_id in user_ids_to_publish_events_for:
        race_info = {
            "eventId": event_id,
            "trackId": track_id,
            "userId": user_id,
            "racedByProxy": False,  # TODO remove hardcoded value
        }

        try:
            race_summary = __calculate_race_summary(event_id, track_id, user_id)

            race_summary_combined = dynamo_helpers.replace_decimal_with_float(
                {**race_info, **race_summary}
            )

            evbEvent = {
                "Detail": json.dumps(race_summary_combined),
                "DetailType": "raceSummaryUpdated",
                "Source": "race-manager",
                "EventBusName": EVENT_BUS_NAME,
            }
            __put_evb_events([evbEvent])

        # raised if there are no more race entries for user
        except ValueError as e:
            logger.info(e)

            evbEvent = {
                "Detail": json.dumps(race_info),
                "DetailType": "raceSummaryDeleted",
                "Source": "race-manager",
                "EventBusName": EVENT_BUS_NAME,
            }
            __put_evb_events([evbEvent])

    return_object = {
        "eventId": event_id,
        "raceIds": deleted_race_ids,
    }
    logger.info(return_object)
    return return_object


@app.resolver(type_name="Mutation", field_name="addRace")
def addRace(eventId, userId, laps, racedByProxy, averageLaps, trackId=1):
    logger.info(averageLaps)
    raceId = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"
    race_info = {
        "eventId": eventId,
        "trackId": trackId,
        "userId": userId,
        "raceId": raceId,
        "createdAt": created_at,
        "racedByProxy": racedByProxy,
    }
    logger.info(laps)
    if laps:
        __store_race(
            {
                **race_info,
                "laps": dynamo_helpers.replace_floats_with_decimal(laps),
                "averageLaps": dynamo_helpers.replace_floats_with_decimal(averageLaps),
            }
        )

        race_summary = __calculate_race_summary(eventId, trackId, userId)

        race_summary_combined = dynamo_helpers.replace_decimal_with_float(
            {**race_info, **race_summary}
        )

        evbEvent = {
            "Detail": json.dumps(race_summary_combined),
            "DetailType": "raceSummaryAdded",
            "Source": "race-manager",
            "EventBusName": EVENT_BUS_NAME,
        }
        __put_evb_events([evbEvent])

    logger.info(race_info)
    return {
        **race_info,
        "laps": laps,
        "averageLaps": averageLaps,
    }  # TODO make proper error handling


@app.resolver(type_name="Mutation", field_name="updateRace")
def updateRace(**args):
    event_id = args["eventId"]
    track_id = args["trackId"]
    user_id = args["userId"]
    race_id = args["raceId"]
    raced_by_proxy = args["racedByProxy"]

    if args["laps"]:  # if no laps left, delete entire race
        update_expressions = dynamo_helpers.generate_update_query(
            args, ["eventId", "sk"]
        )
        sort_key = __generate_sort_key(track_id, user_id, race_id)
        ddb_item = __update_race(event_id, sort_key, update_expressions)

        race_summary = __calculate_race_summary(event_id, track_id, user_id)
        race_summary_combined = dynamo_helpers.replace_decimal_with_float(
            {
                "eventId": event_id,
                "trackId": track_id,
                "userId": user_id,
                "racedByProxy": raced_by_proxy,
                **race_summary,
            }
        )

        evbEvent = {
            "Detail": json.dumps(race_summary_combined),
            "DetailType": "raceSummaryUpdated",
            "Source": "race-manager",
            "EventBusName": EVENT_BUS_NAME,
        }
        __put_evb_events([evbEvent])

    logger.info(ddb_item)
    return ddb_item  # TODO make proper error handling


##################
# Helper functions
##################


def __store_race(item: dict) -> None:
    item_to_store = {
        **item,
        "sk": __generate_sort_key(item["trackId"], item["userId"], item["raceId"]),
        "type": RACE_TYPE,
    }
    logger.info(item_to_store)
    response = ddbTable.put_item(Item=item_to_store)
    logger.info(response)


def __update_race(event_id, sort_key, ddb_update_expressions: dict) -> None:
    response = ddbTable.update_item(
        Key={"eventId": event_id, "sk": sort_key},
        UpdateExpression=ddb_update_expressions["UpdateExpression"],
        ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
        ExpressionAttributeValues=ddb_update_expressions["ExpressionAttributeValues"],
        ReturnValues="ALL_NEW",
    )
    return response["Attributes"]


def __calculate_race_summary(event_id, track_id, user_id) -> dict:
    stored_races = __get_races_by_event_id_and_user_id(event_id, track_id, user_id)
    if not stored_races:
        raise ValueError("No more races entries for user")

    logger.info(stored_races)
    valid_laps, invalid_laps = __get_laps_by_validity(stored_races)
    total_number_of_laps = len(valid_laps) + len(invalid_laps)
    avg_laps_per_attempt = total_number_of_laps / len(stored_races)
    valid_lap_times = __get_valid_lap_times(valid_laps)
    average_lap = __get_fastest_average_lap(stored_races)
    mostConcecutiveLaps = __get_most_concecutive_laps(stored_races)

    # Calculate total lap time (sum of all valid laps)
    total_lap_time = sum(valid_lap_times) if valid_lap_times else 0

    summary = {
        "numberOfValidLaps": len(valid_laps),
        "numberOfInvalidLaps": len(invalid_laps),
        "fastestLapTime": min(valid_lap_times) if valid_lap_times else None,
        "fastestAverageLap": average_lap,
        "avgLapTime": mean(valid_lap_times),
        "lapCompletionRatio": round(float(len(valid_laps) / total_number_of_laps), 1)
        * 100,  # percentage
        "avgLapsPerAttempt": round(avg_laps_per_attempt, 1),
        "mostConcecutiveLaps": mostConcecutiveLaps,
        "totalLapTime": total_lap_time,
    }
    logger.info(summary)
    return summary


def __get_most_concecutive_laps(races: list) -> int:
    most_concecutive_laps_over_all_races = []
    for race in races:
        most_concecutive_laps_of_race = 0
        for lap in race["laps"]:
            if bool(lap["isValid"]):
                most_concecutive_laps_of_race += 1
            else:
                most_concecutive_laps_over_all_races.append(
                    most_concecutive_laps_of_race
                )
                most_concecutive_laps_of_race = 0
        most_concecutive_laps_over_all_races.append(most_concecutive_laps_of_race)

    return max(most_concecutive_laps_over_all_races)


def __get_fastest_average_lap(races: list) -> {}:
    avg_times = []
    for race in races:
        for avgLap in race["averageLaps"]:
            avg_times.append(avgLap)
    result = None
    if len(avg_times) > 0:
        result = reduce(lambda x, y: x if x["avgTime"] < y["avgTime"] else y, avg_times)
    return result


def __get_laps_by_validity(races: list) -> tuple[list, list]:
    valid_laps = []
    invalid_laps = []
    for race in races:
        for lap in race["laps"]:
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


def __get_races_by_event_id_and_user_id(
    event_id: str, track_id: str, user_id: str
) -> list:
    logger.info(f"eventId={event_id}, userId={user_id}")
    sort_key = __generate_sort_key(track_id, user_id)
    response = ddbTable.query(
        KeyConditionExpression=Key("eventId").eq(event_id)
        & Key("sk").begins_with(sort_key),
        FilterExpression=Attr("type").eq(RACE_TYPE),
    )
    logger.info(response)
    return dynamo_helpers.replace_decimal_with_float(response["Items"])


def __put_evb_events(evbEvents: list) -> dict:
    return cloudwatch_events.put_events(Entries=evbEvents)


def __generate_sort_key(track_id: str, user_id: str, race_id: str = None) -> str:
    sort_key = f"TRACK#{track_id}"
    if user_id:
        sort_key = sort_key + f"#USER#{user_id}"
    if race_id:
        sort_key = sort_key + f"#RACE#{race_id}"
    return sort_key
