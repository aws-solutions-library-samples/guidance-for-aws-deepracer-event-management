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


@tracer.capture_lambda_handler
def lambda_handler(evbEvent, context):
    logger.info(evbEvent)

    print(evbEvent)
    detail_type = evbEvent["detail-type"]
    detail = evbEvent["detail"]
    if "eventAdded" in detail_type:
        landing_page_configs = __convertEvbEventToLandingPageConfig(detail)
        __store_landing_page_config(landing_page_configs)
    elif "eventUpdated" in detail_type:
        landing_page_configs = __convertEvbEventToLandingPageConfig(detail)
        __update_landing_page_config(landing_page_configs)
        logger.info(landing_page_configs)
    elif "eventDeleted" in detail_type:
        # __delete_landing_page_config(eventId=detail["eventId"], trackId=1)
        logger.info("TODO: Delete landingPageConfig....")
    return


def __convertEvbEventToLandingPageConfig(detail: dict) -> list:
    landing_page_configs = []
    eventId = detail["eventId"]
    for track in detail["tracks"]:
        trackId = track["trackId"]
        landing_page_configs.append(
            {
                "eventId": eventId,
                "sk": trackId,
                "trackId": trackId,
                "type": "landing_page_config",
                **track["landingPageConfig"],
            }
        )
    return landing_page_configs


def __store_landing_page_config(items: dict):
    logger.info(items)
    for item in items:
        response = ddbTable.put_item(Item=item)
        logger.info(response)
    return


def __update_landing_page_config(landing_page_configs: list) -> None:
    for landing_page_config in landing_page_configs:
        logger.info(
            f"update landing page config for: eventId={landing_page_config['eventId']}"
        )

        # Remove keys from update expression
        eventId = landing_page_config["eventId"]
        del landing_page_config["eventId"]
        sk = landing_page_config["sk"]
        del landing_page_config["sk"]

        ddb_update_expressions = __generate_update_query(landing_page_config)

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
