#!/usr/bin/python3
# encoding=utf-8
import os
import uuid
from datetime import datetime

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

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllEvents")
def getAllEvents():
    response = ddbTable.scan()
    logger.info(response)
    items = response["Items"]
    logger.info(items)
    return items


@app.resolver(type_name="Mutation", field_name="addEvent")
def addEvent(**args):
    eventId = str(uuid.uuid4())
    createdAt = datetime.utcnow().isoformat() + "Z"
    item = {
        **args,
        "eventId": eventId,
        "createdAt": createdAt,
    }
    response = ddbTable.put_item(Item=item)
    logger.info(f"ddb put response: {response}")
    logger.info(f"addEvent: response={item}")
    return item


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
    eventId: str,
    eventName: str,
    raceTimeInMin: int,
    raceNumberOfResets: int,
    raceLapsToFinish: int,
    raceRankingMethod: int,
    eventDate: str = None,
    countryCode: str = None,
    fleetId: str = None,
):
    logger.info(f"udpateEvent: eventId={eventId}")
    response = ddbTable.update_item(
        Key={"eventId": eventId},
        UpdateExpression=(
            "SET eventName= :newName, eventDate= :eventDate, countryCode= "
            " :countryCode, raceTimeInMin= :raceTimeInMin, raceNumberOfResets="
            " :raceNumberOfResets, raceLapsToFinish= :raceLapsToFinish,"
            " raceRankingMethod= :raceRankingMethod, fleetId= :fleetId"
        ),
        ExpressionAttributeValues={
            ":newName": eventName,
            ":eventDate": eventDate,
            ":countryCode": countryCode,
            ":raceTimeInMin": raceTimeInMin,
            ":raceNumberOfResets": raceNumberOfResets,
            ":raceLapsToFinish": raceLapsToFinish,
            ":raceRankingMethod": raceRankingMethod,
            ":fleetId": fleetId,
        },
        ReturnValues="ALL_NEW",
    )
    updatedEvent = response["Attributes"]
    return updatedEvent
