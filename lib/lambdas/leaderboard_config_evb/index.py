#!/usr/bin/python3
# encoding=utf-8
import os

import boto3
from aws_lambda_powertools import Logger, Tracer

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
    if "eventAdded" in detail_type:
        leaderboard_configs = __convertEvbEventToLeaderboardConfig(detail)
        __store_leaderboard_config(leaderboard_configs)
    elif "eventUpdated" in detail_type:
        leaderboard_configs = __convertEvbEventToLeaderboardConfig(detail)
        __update_leaderboard_config(leaderboard_configs)
        logger.info(leaderboard_configs)
    elif "eventDeleted" in detail_type:
        # __delete_leaderboard_config(eventId=detail["eventId"], trackId=1)
        logger.info("TODO: Delete leaderboardConfig....")
    return


def __convertEvbEventToLeaderboardConfig(detail: dict) -> list:
    leaderboardConfigs = []
    eventId = detail["eventId"]
    ranking_method = detail["raceConfig"]["rankingMethod"]

    for track in detail["tracks"]:
        trackId = track["trackId"]
        leaderboardConfigs.append(
            {
                "eventId": eventId,
                "sk": trackId,
                "trackId": trackId,
                "rankingMethod": ranking_method,
                "type": "leaderboard_config",
                "leaderBoardTitle": track["leaderBoardTitle"],
                "leaderBoardFooter": track["leaderBoardFooter"],
            }
        )
    return leaderboardConfigs


def __store_leaderboard_config(items: dict):
    logger.info(items)
    for item in items:
        response = ddbTable.put_item(Item=item)
        logger.info(response)
    return


# def __delete_leaderboard_config(eventId, trackId):
#     logger.info(
#         f"TODO: Delete leaderboardConfig. eventId={eventId}, trackId= {trackId}"
#     )
#     # TODO should the leaderboard configs be deleted if the event is deleted????


def __update_leaderboard_config(leaderboard_configs: list) -> None:
    for leaderboard_config in leaderboard_configs:
        logger.info(
            f"update leaderboard config for: eventId={leaderboard_config['eventId']}"
        )

        # Remove keys from update expression
        eventId = leaderboard_config["eventId"]
        del leaderboard_config["eventId"]
        sk = leaderboard_config["sk"]
        del leaderboard_config["sk"]

        ddb_update_expressions = __generate_update_query(leaderboard_config)

        response = ddbTable.update_item(
            Key={
                "eventId": eventId,
                "sk": sk,
            },
            UpdateExpression=ddb_update_expressions["UpdateExpression"],
            ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
            ExpressionAttributeValues=ddb_update_expressions[
                "ExpressionAttributeValues"
            ],
            ReturnValues="ALL_NEW",
        )
        updatedEvent = response["Attributes"]
    return updatedEvent


def __generate_update_query(fields):
    exp = {
        "UpdateExpression": "set",
        "ExpressionAttributeNames": {},
        "ExpressionAttributeValues": {},
    }
    for key, value in fields.items():
        exp["UpdateExpression"] += f" #{key} = :{key},"
        exp["ExpressionAttributeNames"][f"#{key}"] = key
        exp["ExpressionAttributeValues"][f":{key}"] = value
    exp["UpdateExpression"] = exp["UpdateExpression"][0:-1]
    return exp
