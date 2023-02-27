#!/usr/bin/python3
# encoding=utf-8
import decimal
import os

import boto3
import requests
from aws_lambda_powertools import Logger, Tracer
from boto3.dynamodb.conditions import Key
from requests_aws_sign import AWSV4Sign

tracer = Tracer()
logger = Logger()

DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(DDB_TABLE_NAME)

LEADERBOARD_CONFIG_TYPE = "leaderboard_config"
LEADERBOARD_ENTRY_TYPE = "leaderboard_entry"


@tracer.capture_lambda_handler
def lambda_handler(evbEvent, context):
    logger.info(evbEvent)

    detail_type = evbEvent["detail-type"]
    detail = evbEvent["detail"]
    if "raceSummaryAdded" in detail_type:
        leaderboard = __get_leaderboard_by_event_id(
            detail["eventId"], detail["trackId"]
        )
        if leaderboard["config"]["rankingMethod"] == "BEST_LAP_TIME":
            current_leaderboard_entry = __update_entry_if_faster_lap_time(
                leaderboard, detail
            )
            __addLeaderboardEntry(current_leaderboard_entry)
    else:
        raise Exception(f"detail_type={detail_type} is not supported")
    return


def __update_entry_if_faster_lap_time(leaderboard: dict, new_entry: dict) -> dict:
    leaderboard_entry = __find_user_in_leaderboard(
        new_entry["userId"], leaderboard["entries"]
    )
    item_to_store = new_entry
    if leaderboard_entry:
        new_fastest_lap_time = new_entry["fastestLapTime"]
        current_fastest_lap_time = leaderboard_entry["fastestLapTime"]
        if new_fastest_lap_time > current_fastest_lap_time:
            # Only update race stats but keep fastest and avg lap times since they
            keep_from_current_entry = {
                "fastestLapTime": current_fastest_lap_time,
                "avgLapTime": leaderboard_entry["avgLapTime"],
            }
            item_to_store = {**new_entry, **keep_from_current_entry}
    __store_leaderboard_entry(item_to_store)
    return item_to_store


def __get_leaderboard_by_event_id(event_id: str, track_id: int) -> str:
    response = ddbTable.query(KeyConditionExpression=Key("eventId").eq(event_id))
    logger.info(response)
    return __convert_ddb_into_leaderboard(response["Items"])


def __convert_ddb_into_leaderboard(items):
    leaderboard = {"config": {}, "entries": []}
    for item in items:
        if item["type"] == LEADERBOARD_CONFIG_TYPE:
            leaderboard["config"] = item
        else:
            leaderboard["entries"].append(item)
    logger.info(leaderboard)
    return leaderboard


def __store_leaderboard_entry(item: dict):
    item_to_store = {
        "sk": f"{item['trackId']}#{item['userId']}",
        "type": LEADERBOARD_ENTRY_TYPE,
        **item,
    }
    response = ddbTable.put_item(Item=__replace_floats_with_decimal(item_to_store))
    logger.info(response)
    return


def __find_user_in_leaderboard(user_id: str, entries: list) -> dict:
    for entry in entries:
        if entry["userId"] == user_id:
            return entry
    return None


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


# def __generate_update_query(fields):
#     exp = {
#         "UpdateExpression": "set",
#         "ExpressionAttributeNames": {},
#         "ExpressionAttributeValues": {},
#     }
#     for key, value in fields.items():
#         exp["UpdateExpression"] += f" #{key} = :{key},"
#         exp["ExpressionAttributeNames"][f"#{key}"] = key
#         exp["ExpressionAttributeValues"][f":{key}"] = value
#     exp["UpdateExpression"] = exp["UpdateExpression"][0:-1]
#     return exp


def __addLeaderboardEntry(variables):
    logger.info(variables)
    """Triggers a mutation on the Appsync API to trigger a subscription"""
    session = boto3.session.Session()
    credentials = session.get_credentials()
    region = session.region_name or "eu-west-1"

    endpoint = os.environ.get("APPSYNC_URL", None)
    headers = {"Content-Type": "application/json"}

    query = """
       mutation AddLeaderboardEntry(
            $avgLapTime: Float!
            $avgLapsPerAttempt: Float!
            $numberOfValidLaps: Int!
            $numberOfInvalidLaps: Int!
            $eventId: ID!
            $fastestLapTime: Float!
            $lapCompletionRatio: Float!
            $trackId: ID!
            $username: String!
        ) {
            addLeaderboardEntry(
                avgLapTime: $avgLapTime
                avgLapsPerAttempt: $avgLapsPerAttempt
                numberOfValidLaps: $numberOfValidLaps
                numberOfInvalidLaps: $numberOfInvalidLaps
                eventId: $eventId
                fastestLapTime: $fastestLapTime
                lapCompletionRatio: $lapCompletionRatio
                trackId: $trackId
                username: $username
            ) {
            avgLapTime
            avgLapsPerAttempt
            eventId
            fastestLapTime
            lapCompletionRatio
            numberOfInvalidLaps
            numberOfValidLaps
            trackId
            username
            }
        }
        """

    payload = {
        "query": query,
        "variables": variables,
    }
    logger.info(payload)
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
