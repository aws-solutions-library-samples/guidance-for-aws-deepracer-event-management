#!/usr/bin/python3
# encoding=utf-8
import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

EVENTS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="deleteEvents")
def deleteEvents(eventIds: list[str]):
    logger.info(f"deleteEvents: eventIds={eventIds}")

    events = []
    for eventId in eventIds:
        response = ddbTable.delete_item(Key={"eventId": eventId})
        logger.info(response)
        events.append({"eventId": eventId})

    return events


@app.resolver(type_name="Mutation", field_name="updateEvent")
def udpateEvent(
    eventId,
    **args,
):
    logger.info(f"udpateEvent: eventId={eventId}")
    ddb_update_expressions = __generate_update_query(args)

    response = ddbTable.update_item(
        Key={"eventId": eventId},
        UpdateExpression=ddb_update_expressions["UpdateExpression"],
        ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
        ExpressionAttributeValues=ddb_update_expressions["ExpressionAttributeValues"],
        ReturnValues="ALL_NEW",
    )
    updatedEvent = response["Attributes"]
    return updatedEvent


# TODO move into lambda layer
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
