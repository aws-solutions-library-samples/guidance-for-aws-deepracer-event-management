#!/usr/bin/python3
# encoding=utf-8
import decimal
import os
import uuid

import boto3
import requests
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key
from requests_aws_sign import AWSV4Sign

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

LAPS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


####################
# LeaderBoard methods
####################
@app.resolver(type_name="Query", field_name="getLeaderBoardEntries")
def getLeaderBoardEntries(eventId: str):
    logger.info(f"eventId: {eventId}")
    response = ddbTable.query(KeyConditionExpression=Key("pk").eq(f"RECORD#{eventId}"))
    logger.info(response)
    leaderboard_entries = []
    for record in response["Items"]:
        leaderboard_entries.append({"username": record["sk"], "time": record["time"]})
    return sorted(leaderboard_entries, key=lambda x: x["time"])


####################
# Admin methods
####################
@app.resolver(type_name="Query", field_name="getRacesForUser")
def getRacesForUser(eventId, username):
    logger.info("getRacesForUser start")
    response = ddbTable.query(
        KeyConditionExpression=Key("pk").eq(f"RACE#{eventId}")
        & Key("sk").begins_with(username)
    )
    logger.info(f"ddb query response: {response}")
    listOfRacesForUser = dbEntriesToRaceList(response["Items"])
    return listOfRacesForUser


@app.resolver(type_name="Mutation", field_name="deleteRaceForUser")
def deleteRaceForUser(eventId, username, raceId):
    response = ddbTable.query(
        KeyConditionExpression=Key("pk").eq(f"RACE#{eventId}")
        & Key("sk").begins_with(f"{username}#{raceId}#")
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
def deleteLapForUser(eventId, username, raceId, lapId):
    ddbTable.delete_item(
        Key={"pk": f"RACE#{eventId}", "sk": f"{username}#{raceId}#{lapId}"}
    )

    # TODO Check if RECORD for user shall be updated
    # TODO get all remaining lap times for user and distil current record time
    # TODO get record for user and compare if it shall be updated

    return {"raceId": raceId, "lapId": lapId}


####################
# Time keeper methods
####################
@app.resolver(type_name="Mutation", field_name="addRace")
def addRace(eventId, username, laps):
    raceId = str(uuid.uuid4())
    print(laps)
    logger.info(laps)

    fastestLapTimeInCurrentRace = None
    with ddbTable.batch_writer() as batch:
        for lap in laps:
            logger.info(lap)

            lapId = uuid.uuid4()
            lap = __replace_floats_with_decimal(lap)
            lapTime = lap["time"]

            response = batch.put_item(
                Item={
                    **{"pk": f"RACE#{eventId}", "sk": f"{username}#{raceId}#{lapId}"},
                    **lap,
                }
            )
            logger.info(f"ddb put resp: {response}")

            if lap["isValid"] and (
                not fastestLapTimeInCurrentRace or fastestLapTimeInCurrentRace > lapTime
            ):
                logger.info(
                    "fastest race time: current"
                    f" fastest:{fastestLapTimeInCurrentRace}, this lap: {lapTime}"
                )
                fastestLapTimeInCurrentRace = lap["time"]

    # Create or update user lap record
    response = ddbTable.get_item(Key={"pk": f"RECORD#{eventId}", "sk": username})

    logger.info(f"lap record ddb response: {response}")

    if "Item" in response:
        userFastestLapTime = response["Item"]["time"]
        if decimal.Decimal(fastestLapTimeInCurrentRace) < userFastestLapTime:
            logger.info(
                f"update user record: fastest time: {userFastestLapTime}, this race:"
                f" {fastestLapTimeInCurrentRace}"
            )
            updateUserRecord(eventId, username, fastestLapTimeInCurrentRace)
        else:
            logger.info(
                f"Will not update record for user: fastest time={userFastestLapTime},"
                f" this race={fastestLapTimeInCurrentRace}"
            )
    else:
        logger.info(
            "create user record: fastest time: None, this race:"
            f" {fastestLapTimeInCurrentRace}"
        )
        updateUserRecord(eventId, username, fastestLapTimeInCurrentRace)
    return {"id": raceId}


@app.resolver(type_name="Query", field_name="getAllRacers")
def getAllRacers():
    paginator = client_cognito.get_paginator("list_users")
    response_iterator = paginator.paginate(
        UserPoolId=user_pool_id,
        PaginationConfig={
            "PageSize": 30,
        },
    )

    # TODO the parts below can be optimized
    users = []
    for r in response_iterator:
        users.append(r["Users"])

    # Squash the list of lists
    all_users = [item for sublist in users for item in sublist]
    logger.info(all_users)

    list_user_objects = []
    for user in all_users:
        user_object = {"username": user["Username"]}
        for attribute in user["Attributes"]:
            if attribute["Name"] == "email":
                user_object["email"] = attribute["Value"]
        list_user_objects.append(user_object)

    logger.info(list_user_objects)
    return list_user_objects


##################
# Helper functions
##################
def updateUserRecord(eventId, username, newFastestLapTime):
    response = ddbTable.update_item(
        Key={"pk": f"RECORD#{eventId}", "sk": username},
        UpdateExpression="set #time=:t",
        ExpressionAttributeNames={"#time": "time"},
        ExpressionAttributeValues={":t": decimal.Decimal(newFastestLapTime)},
        ReturnValues="UPDATED_NEW",
    )
    logger.info(f"update record response: {response}")
    newFastestLapForUser(eventId, username, newFastestLapTime)


def newFastestLapForUser(eventId, username, time):
    """Triggers a mutation on the Appsync API to trigger a subscription"""
    session = boto3.session.Session()
    credentials = session.get_credentials()
    region = session.region_name or "eu-west-1"

    endpoint = os.environ.get("APPSYNC_URL", None)
    headers = {"Content-Type": "application/json"}

    query = """
        mutation NewFastestLapForUser(
            $eventId: ID!
            $time: Float!
            $username: String!
        ) {
            newFastestLapForUser(eventId: $eventId, time: $time, username: $username) {
            eventId
            time
            username
            }
        }
        """

    payload = {
        "query": query,
        "variables": {"username": username, "time": time, "eventId": eventId},
    }

    appsync_region = __parse_region_from_url(endpoint) or region
    auth = AWSV4Sign(credentials, appsync_region, "appsync")
    try:
        logger.info("posting mutation!!")
        response = requests.post(
            endpoint, auth=auth, json=payload, headers=headers
        ).json()
        logger.info(f"mutation response: {response}")
        if "errors" in response:
            logger.error("Error attempting to publish to AppSync")
            logger.error(response["errors"])
        else:
            return response
    except Exception as exception:
        logger.exception("Error with Mutation")
        logger.exception(exception)

    return None


def __parse_region_from_url(url):
    """Parses the region from the appsync url so we call the correct region regardless
    of the session or the argument"""
    # Example URL: https://xxxxxxx.appsync-api.us-east-2.amazonaws.com/graphql
    split = url.split(".")
    if 2 < len(split):
        return split[2]
    return None


def dbEntriesToRaceList(dbEntries):
    lapsPerRace = {}
    for dbEntry in dbEntries:
        username = dbEntry["sk"].split("#")[0]
        raceId = dbEntry["sk"].split("#")[1]
        lapId = dbEntry["sk"].split("#")[2]
        dbEntry["lapId"] = lapId

        if raceId in lapsPerRace:
            lapsPerRace[raceId]["laps"].append(dbEntry)
        else:
            lapsPerRace[raceId] = {
                "id": raceId,
                "username": username,
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
