#!/usr/bin/python3
# encoding=utf-8
import decimal
import json
import os

import boto3
import requests
from aws_lambda_powertools import Logger, Tracer
from requests_aws_sign import AWSV4Sign

tracer = Tracer()
logger = Logger()

DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(DDB_TABLE_NAME)

LEADERBOARD_CONFIG_TYPE = "leaderboard_config"
LEADERBOARD_ENTRY_TYPE = "leaderboard_entry"

cognito_client = boto3.client("cognito-idp")
USER_POOL_ID = os.environ["USER_POOL_ID"]


@tracer.capture_lambda_handler
def lambda_handler(evbEvent, context):
    logger.info(evbEvent)

    detail_type = evbEvent["detail-type"]
    detail = evbEvent["detail"]
    if "raceSummaryAdded" in detail_type:
        username = __get_username_by_user_id(detail["userId"])
        detail = {**detail, "username": username}
        __store_leaderboard_entry(detail)
        __add_to_leaderboard(detail)
    elif "raceSummaryUpdated" in detail_type:
        username = __get_username_by_user_id(detail["userId"])
        leaderboard_entry = {"username": username, **detail}
        __store_leaderboard_entry(leaderboard_entry)
        __update_entry_on_leaderboard(leaderboard_entry)
    elif "raceSummaryDeleted" in detail_type:
        username = __get_username_by_user_id(detail["userId"])
        leaderboard_entry = {"username": username, **detail}
        __delete_leaderboard_entry(detail)
        __delete_from_leaderboard(leaderboard_entry)

    else:
        raise Exception(f"detail_type={detail_type} is not supported")
    return


def __get_username_by_user_id(userId):
    logger.info(f"userId = {userId}")
    response = cognito_client.list_users(
        UserPoolId=USER_POOL_ID,
        AttributesToGet=["custom:countryCode"],
        Filter=f'sub = "{userId}"',
    )
    logger.info(response)
    username = response["Users"][0]["Username"]
    logger.info(username)
    return username


# def __get_username_from_entry(item):
#     event_id = item["eventId"]
#     sort_key = f"{item['trackId']}#{item['userId']}"
#     response = ddbTable.get_item(Key={"eventId": event_id, "sk": sort_key})
#     if "Item" in response:
#         return response["Item"]["username"]
#     raise ValueError("No DDB entry to get username from")


def __delete_leaderboard_entry(item):
    event_id = item["eventId"]
    sort_key = f"{item['trackId']}#{item['userId']}"
    response = ddbTable.delete_item(Key={"eventId": event_id, "sk": sort_key})
    logger.info(response)
    return


def __store_leaderboard_entry(item: dict):
    item_to_store = {
        "sk": f"{item['trackId']}#{item['userId']}",
        "type": LEADERBOARD_ENTRY_TYPE,
        **item,
    }
    response = ddbTable.put_item(Item=__replace_floats_with_decimal(item_to_store))
    logger.info(response)
    return


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


def __add_to_leaderboard(variables):
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
            $racedByProxy: Boolean!
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
                racedByProxy: $racedByProxy
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
            racedByProxy
            }
        }
        """

    __send_mutation(query, variables)
    return None


def __update_entry_on_leaderboard(variables):
    query = """
       mutation UpdateLeaderboardEntry(
            $avgLapTime: Float!
            $avgLapsPerAttempt: Float!
            $numberOfValidLaps: Int!
            $numberOfInvalidLaps: Int!
            $eventId: ID!
            $fastestLapTime: Float!
            $lapCompletionRatio: Float!
            $trackId: ID!
            $username: String!
            $racedByProxy: Boolean!
        ) {
            updateLeaderboardEntry(
                avgLapTime: $avgLapTime
                avgLapsPerAttempt: $avgLapsPerAttempt
                numberOfValidLaps: $numberOfValidLaps
                numberOfInvalidLaps: $numberOfInvalidLaps
                eventId: $eventId
                fastestLapTime: $fastestLapTime
                lapCompletionRatio: $lapCompletionRatio
                trackId: $trackId
                username: $username
                racedByProxy: $racedByProxy
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
            racedByProxy
            }
        }
        """

    __send_mutation(query, variables)
    return None


def __delete_from_leaderboard(variables):
    query = """
       mutation DeleteLeaderboardEntry(
            $eventId: ID!
            $trackId: ID!
            $username: String!
        ) {
            deleteLeaderboardEntry(
                eventId: $eventId
                trackId: $trackId
                username: $username
            ) {
            eventId
            trackId
            username
            }
        }
        """

    __send_mutation(query, variables)
    return None


def __send_mutation(query, variables):
    logger.info(variables)
    """Triggers a mutation on the Appsync API to trigger a subscription"""
    session = boto3.session.Session()
    credentials = session.get_credentials()
    region = session.region_name or "eu-west-1"

    endpoint = os.environ.get("APPSYNC_URL", None)
    headers = {"Content-Type": "application/json"}

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
