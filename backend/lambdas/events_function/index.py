#!/usr/bin/python3
# encoding=utf-8
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.event_handler import AppSyncResolver
import boto3
from boto3.dynamodb.conditions import Key
import decimal
import os
import uuid
import json
from datetime import datetime

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

EVENTS_DDB_TABLE_NAME = os.environ['DDB_TABLE']
dynamodb = boto3.resource('dynamodb')
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)


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
def addEvent(eventName:str, tracks=None):
    eventId = str(uuid.uuid4())
    createdAt = datetime.utcnow().isoformat() + 'Z'
    item = {'id': eventId, 'eventName': eventName, 'createdAt': createdAt, 'tracks': tracks}
    response = ddbTable.put_item(Item = item)
    logger.info(f'ddb put response: {response}')
    logger.info(f'addEvent: response={item}')
    return item

@app.resolver(type_name="Mutation", field_name="deleteEvent")
def deleteEvent(eventId:str):
    logger.info(f'deleteEvent: eventId={eventId}')
    response = ddbTable.delete_item(Key={'id': eventId})
    logger.info(response)
    return {'id': eventId}

@app.resolver(type_name="Mutation", field_name="updateEvent")
def udpateEvent(eventId:str):
    logger.info(f'udpateEvent: eventId={eventId}')
    #TODO update event in DDB
    return {'id': eventId}

@app.resolver(type_name="Mutation", field_name="addTrack")
def addTrack(eventId: str, trackName:str, trackTag: str):
    trackId = str(uuid.uuid4())
    #TODO create track in DDB
    response = {'id': trackId, 'eventId': eventId, 'trackName': trackName, 'trackTag': trackTag}
    logger.info(f'addEvent: response={response}')
    return response

@app.resolver(type_name="Mutation", field_name="deleteTrack")
def deleteTrack(trackId:str):
    #TODO delete track in DDB
    return {'id': trackId}

@app.resolver(type_name="Mutation", field_name="updateTrack")
def udpateTrack(trackId:str):
    #TODO update event in DDB
    return {'id': trackId}

####################
# Admin methods
####################
@app.resolver(type_name="Query", field_name="getRacesForUser")
def getRacesForUser(username):
    logger.info(f'getRacesForUser start')
    response = ddbTable.query(
        KeyConditionExpression=Key('pk').eq(
            'RACE') & Key('sk').begins_with(username)
    )
    logger.info(f'ddb query response: {response}')
    listOfRacesForUser = dbEntriesToRaceList(response['Items'])
    return listOfRacesForUser


@app.resolver(type_name="Mutation", field_name="deleteRaceForUser")
def deleteRaceForUser(username, raceId):
    response = ddbTable.query(
        KeyConditionExpression=Key('pk').eq('RACE') & Key(
            'sk').begins_with(f'{username}#{raceId}#')
    )
    items_to_delete = response['Items']

    with ddbTable.batch_writer() as batch:
        laps = []
        for item in items_to_delete:
            response = batch.delete_item(Key={'pk': 'RACE', 'sk': item['sk']})
            logger.info(response)
            lapId = item['sk'].rsplit('#', 1)[1]
            laps.append({'lapId': lapId})

    # TODO check if RECORD for user shall be updated
    return {'id': raceId, 'laps': laps}


@app.resolver(type_name="Mutation", field_name="deleteLapForUser")
def deleteLapForUser(username, raceId, lapId):
    response = ddbTable.delete_item(
        Key={'pk': 'RACE', 'sk': f'{username}#{raceId}#{lapId}'})

    # TODO Check if RECORD for user shall be updated
    # TODO get all remaining lap times for user and distil current record time
    # TODO get record for user and compare if it shall be updated

    return {'raceId': raceId, 'lapId': lapId}


####################
# Time keeper methods
####################
@app.resolver(type_name="Mutation", field_name="addRace")
def addRace(race):
    username = race['username']
    raceId = str(uuid.uuid4())

    fastestLapTimeInCurrentRace = None
    with ddbTable.batch_writer() as batch:
        for lap in race['laps']:
            lapId = uuid.uuid4()
            lap = __replace_floats_with_decimal(lap)
            lapTime = lap['time']

            response = batch.put_item(Item={
                **{'pk': 'RACE','sk': f'{username}#{raceId}#{lapId}'},
                **lap
            })
            logger.info(f'ddb put resp: {response}')

            if lap['isValid'] and (not fastestLapTimeInCurrentRace or fastestLapTimeInCurrentRace > lapTime):
                logger.info(
                    f'fastest race time: current fastest:{fastestLapTimeInCurrentRace}, this lap: {lapTime}')
                fastestLapTimeInCurrentRace = lap['time']

    # Create or update user lap record
    response = ddbTable.get_item(Key={'pk': 'RECORD', 'sk': username})

    logger.info(f'lap record ddb response: {response}')

    if 'Item' in response:
        userFastestLapTime = response['Item']['time']
        if decimal.Decimal(fastestLapTimeInCurrentRace) < userFastestLapTime:
            logger.info(
                f'update user record: fastest time: {userFastestLapTime}, this race: {fastestLapTimeInCurrentRace}')
            updateUserRecord(username, fastestLapTimeInCurrentRace)
        else:
            logger.info(
                f'Will not update record for user: fastest time={userFastestLapTime}, this race={fastestLapTimeInCurrentRace}')
    else:
        logger.info(
            f'create user record: fastest time: None, this race: {fastestLapTimeInCurrentRace}')
        updateUserRecord(username, fastestLapTimeInCurrentRace)
    return {'id': raceId}



##################
# Helper functions
##################
def updateUserRecord(username, newFastestLapTime):
    response = ddbTable.update_item(
        Key={'pk': 'RECORD', 'sk': username},
        UpdateExpression="set #time=:t",
        ExpressionAttributeNames={
            '#time': 'time'
        },
        ExpressionAttributeValues={
            ':t': decimal.Decimal(newFastestLapTime)},
        ReturnValues="UPDATED_NEW")
    logger.info(f'update record response: {response}')
    newFastestLapForUser(username, newFastestLapTime, username)


def newFastestLapForUser(username, time, id):
    '''Triggers a mutation on the Appsync API to trigger a subscription'''
    session = boto3.session.Session()
    credentials = session.get_credentials()
    region = session.region_name or 'eu-west-1'

    endpoint = os.environ.get('APPSYNC_URL', None)
    headers = {"Content-Type": "application/json"}

    entry = {'username': username, 'time': time}

    query = """
        mutation NewFastestLapForUser($entry: LeaderBoardEntryInput!) {
            newFastestLapForUser(entry: $entry){
                time
                username
            }
        }"""

    payload = {"query": query, 'variables': {'entry': entry}}

    appsync_region = __parse_region_from_url(endpoint) or region
    auth = AWSV4Sign(credentials, appsync_region, 'appsync')
    try:
        logger.info('posting mutation!!')
        response = requests.post(
            endpoint,
            auth=auth,
            json=payload,
            headers=headers
        ).json()
        logger.info(f'mutation response: {response}')
        if 'errors' in response:
            logger.error('Error attempting to publish to AppSync')
            logger.error(response['errors'])
        else:
            return response
    except Exception as exception:
        logger.exception('Error with Mutation')
        logger.exception(exception)

    return None


def __parse_region_from_url(url):
    """Parses the region from the appsync url so we call the correct region regardless of the session or the argument"""
    # Example URL: https://xxxxxxx.appsync-api.us-east-2.amazonaws.com/graphql
    split = url.split('.')
    if 2 < len(split):
        return split[2]
    return None


def dbEntriesToRaceList(dbEntries):
    lapsPerRace = {}
    for dbEntry in dbEntries:
        raceId = dbEntry['sk'].split('#')[1]
        lapId = dbEntry['sk'].split('#')[2]
        dbEntry['lapId'] = lapId

        if raceId in lapsPerRace:
            lapsPerRace[raceId]['laps'].append(dbEntry)
        else:
            lapsPerRace[raceId] = {
                'id': raceId,
                'laps': [dbEntry]
            }
    logger.info(f'lapsPerRace: {lapsPerRace}')

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
        return decimal.Decimal(obj).quantize(decimal.Decimal('.0001'),
                                             rounding=decimal.ROUND_DOWN)
    else:
        return obj
