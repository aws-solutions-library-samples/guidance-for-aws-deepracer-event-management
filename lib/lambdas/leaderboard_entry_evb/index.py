#!/usr/bin/python3
# encoding=utf-8
import os

import appsync_helpers
import boto3
import dynamo_helpers
from aws_lambda_powertools import Logger, Tracer

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
        username, countryCode = __get_username_by_user_id(detail["userId"])
        detail = {**detail, "username": username, "countryCode": countryCode}
        __store_leaderboard_entry(detail)
        __add_to_leaderboard(detail)
    elif "raceSummaryUpdated" in detail_type:
        username, countryCode = __get_username_by_user_id(detail["userId"])
        leaderboard_entry = {"username": username, "countryCode": countryCode, **detail}
        __store_leaderboard_entry(leaderboard_entry)
        __update_entry_on_leaderboard(leaderboard_entry)
    elif "raceSummaryDeleted" in detail_type:
        username, countryCode = __get_username_by_user_id(detail["userId"])
        leaderboard_entry = {"username": username, "countryCode": countryCode, **detail}
        __delete_leaderboard_entry(detail)
        __delete_from_leaderboard(leaderboard_entry)

    else:
        raise Exception(f"detail_type={detail_type} is not supported")
    return


def __get_username_by_user_id(userId):
    logger.info(f"userId = {userId}")
    response = cognito_client.list_users(
        UserPoolId=USER_POOL_ID,
        # AttributesToGet=["custom:countryCode"],
        Filter=f'sub = "{userId}"',
    )
    logger.info(response)
    user = response["Users"][0]
    username = user["Username"]
    # pull "countryCode" out off attributes if it exists
    countryCode = ""
    for attributes in user["Attributes"]:
        if attributes["Name"] == "custom:countryCode":
            # logger.info(attributes["Value"])
            countryCode = attributes["Value"]

    logger.info(username)
    logger.info(countryCode)
    return username, countryCode


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
    response = ddbTable.put_item(
        Item=dynamo_helpers.replace_floats_with_decimal(item_to_store)
    )
    logger.info(response)
    return


def __add_to_leaderboard(variables):
    query = """
       mutation AddLeaderboardEntry(
            $avgLapTime: Float!
            $avgLapsPerAttempt: Float!
            $numberOfValidLaps: Int!
            $numberOfInvalidLaps: Int!
            $eventId: ID!
            $fastestLapTime: Float!
            $fastestAverageLap: LeaderboardAverageLapInput
            $lapCompletionRatio: Float!
            $trackId: ID!
            $username: String!
            $racedByProxy: Boolean!
            $countryCode: String!
            $mostConcecutiveLaps: Int!
        ) {
            addLeaderboardEntry(
                avgLapTime: $avgLapTime
                avgLapsPerAttempt: $avgLapsPerAttempt
                numberOfValidLaps: $numberOfValidLaps
                numberOfInvalidLaps: $numberOfInvalidLaps
                eventId: $eventId
                fastestLapTime: $fastestLapTime
                fastestAverageLap: $fastestAverageLap
                lapCompletionRatio: $lapCompletionRatio
                trackId: $trackId
                username: $username
                racedByProxy: $racedByProxy
                countryCode: $countryCode
                mostConcecutiveLaps: $mostConcecutiveLaps
            ) {
            avgLapTime
            avgLapsPerAttempt
            eventId
            fastestLapTime
            fastestAverageLap {
                startLapId
                endLapId
                avgTime
            }
            lapCompletionRatio
            numberOfInvalidLaps
            numberOfValidLaps
            trackId
            username
            racedByProxy
            countryCode
            mostConcecutiveLaps
            }
        }
        """

    appsync_helpers.send_mutation(query, variables)
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
            $fastestAverageLap: LeaderboardAverageLapInput
            $lapCompletionRatio: Float!
            $trackId: ID!
            $username: String!
            $racedByProxy: Boolean!
            $countryCode: String
        ) {
            updateLeaderboardEntry(
                avgLapTime: $avgLapTime
                avgLapsPerAttempt: $avgLapsPerAttempt
                numberOfValidLaps: $numberOfValidLaps
                numberOfInvalidLaps: $numberOfInvalidLaps
                eventId: $eventId
                fastestLapTime: $fastestLapTime
                fastestAverageLap: $fastestAverageLap
                lapCompletionRatio: $lapCompletionRatio
                trackId: $trackId
                username: $username
                racedByProxy: $racedByProxy
                countryCode: $countryCode
            ) {
            avgLapTime
            avgLapsPerAttempt
            eventId
            fastestLapTime
            fastestAverageLap {
                startLapId
                endLapId
                avgTime
            }
            lapCompletionRatio
            numberOfInvalidLaps
            numberOfValidLaps
            trackId
            username
            racedByProxy
            countryCode
            }
        }
        """

    appsync_helpers.send_mutation(query, variables)
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

    appsync_helpers.send_mutation(query, variables)
    return None
