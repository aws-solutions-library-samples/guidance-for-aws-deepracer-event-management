#!/usr/bin/python3
# encoding=utf-8
import decimal
import os

import boto3

# import requests
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key

# import uuid

# from requests_aws_sign import AWSV4Sign

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

LEADERBOARD_CONFIG_TYPE = "leaderboard_config"
LEADERBOARD_ENTRY_TYPE = "leaderboard_entry"

LAPS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getLeaderboard")
def getLeaderboard(eventId: str, trackId: str = "1"):
    logger.info(f"eventId: {eventId}, trackId: {trackId}")

    response = ddbTable.query(
        KeyConditionExpression=Key("eventId").eq(eventId)
        & Key("sk").begins_with(trackId)
    )
    logger.info(response["Items"])

    leaderboard = {"config": {}, "entries": []}
    # leaderboard_entries = []
    for record in response["Items"]:
        logger.info(record)
        if record["type"] == LEADERBOARD_CONFIG_TYPE:
            leaderboard["config"] = record
        else:
            leaderboard["entries"].append(record)
            # logger.info(leaderboard_entries)
            # username = record["username"]
            # new_time = record["fastestLapTime"]

            # item_index = next(
            #     (
            #         index
            #         for (index, d) in enumerate(leaderboard_entries)
            #         if d["username"] == username
            #     ),
            #     -1,
            # )
            # logger.info(item_index)
            # if item_index >= 0:
            #     if new_time < leaderboard_entries[item_index]["fastestLapTime"]:
            #         logger.info("Updating time in existing element")
            #         leaderboard_entries[item_index]["fastestLapTime"] = new_time
            #         logger.info(leaderboard_entries)
            #     else:
            #         logger.info("Time was not faster for user")
            # else:
            #     logger.info("Item not found")
            #     leaderboard_entries.append(
            #         {"username": username, "fastestLapTime": new_time}
            #     )
            #     logger.info(leaderboard_entries)
    logger.info(leaderboard)
    leaderboard["entries"] = sorted(
        leaderboard["entries"], key=lambda x: x["fastestLapTime"]
    )

    logger.info(leaderboard)

    return leaderboard


def __get_user_name_from_id(users, userId):
    for user in users:
        logger.info(user)
        if user["id"] == userId:
            logger.info("match returning username=" + user["username"])
            return user["username"]
    return None


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
