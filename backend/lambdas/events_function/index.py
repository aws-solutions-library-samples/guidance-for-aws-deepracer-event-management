#!/usr/bin/python3
# encoding=utf-8
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.event_handler import AppSyncResolver
import boto3
from boto3.dynamodb.conditions import Key
import os
import uuid
from datetime import datetime

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

EVENTS_DDB_TABLE_NAME = os.environ['DDB_TABLE']
dynamodb = boto3.resource('dynamodb')
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or 'eu-west-1'
graphql_endpoint = os.environ.get('APPSYNC_URL', None)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllEvents")
def getAllEvents():
    response = ddbTable.scan()
    logger.info(response)
    items = response['Items']
    logger.info(items)
    return items


@app.resolver(type_name="Mutation", field_name="addEvent")
def addEvent(eventName: str, tracks=None):
    # TODO add regular expression for tag validation
    # TODO verify that the wanted tag is not already in use for another track
    eventId = str(uuid.uuid4())
    createdAt = datetime.utcnow().isoformat() + 'Z'
    item = {'eventId': eventId, 'eventName': eventName,
            'createdAt': createdAt, 'tracks': tracks}
    response = ddbTable.put_item(Item=item)
    logger.info(f'ddb put response: {response}')
    logger.info(f'addEvent: response={item}')
    return item


@app.resolver(type_name="Mutation", field_name="deleteEvent")
def deleteEvent(eventId: str):
    logger.info(f'deleteEvent: eventId={eventId}')
    response = ddbTable.delete_item(Key={'eventId': eventId})
    logger.info(response)
    return {'eventId': eventId}


@app.resolver(type_name="Mutation", field_name="updateEvent")
def udpateEvent(eventId: str, eventName: str, tracks):
    logger.info(f'udpateEvent: eventId={eventId}')
    # TODO make so that only attributes which are provided is updated

    response = ddbTable.update_item(
        Key={
            'eventId': eventId
        },
        UpdateExpression='SET eventName= :newName, tracks= :newTracks',
        ExpressionAttributeValues={
            ':newName': eventName,
            ':newTracks': tracks
        },
        ReturnValues="UPDATED_NEW"
    )
    return {'eventId': eventId}
