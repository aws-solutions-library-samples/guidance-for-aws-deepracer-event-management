import json
import os

import appsync_helpers
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils

tracer = Tracer()
logger = Logger()

JOBS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(JOBS_DDB_TABLE_NAME)


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    carInstanceId = event["data"]["carInstanceId"]
    carName = event["data"]["carName"]
    carFleetId = event["data"]["carFleetId"]
    carFleetName = event["data"]["carFleetName"]
    carIpAddress = event["data"]["carIpAddress"]
    eventId = event["data"]["eventId"]
    eventName = event["data"]["eventName"]
    modelKey = event["data"]["modelKey"]
    username = event["data"]["username"]
    startTime = scalar_types_utils.aws_datetime()
    status = "Created"

    logger.info(f"JobId: {jobId}, carInstanceId: {carInstanceId}, modelKey: {modelKey}")

    item = {
        "jobId": jobId,
        "carInstanceId": carInstanceId,
        "carName": carName,
        "carFleetId": carFleetId,
        "carFleetName": carFleetName,
        "carIpAddress": carIpAddress,
        "eventId": eventId,
        "eventName": eventName,
        "modelKey": modelKey,
        "username": username,
        "startTime": startTime,
        "status": status,
    }

    try:
        query = """mutation createStartUploadToCarDbEntry($carFleetId: String!, $carFleetName: String!, $carInstanceId: String!, $carIpAddress: String!, $carName: String!, $jobId: ID!, $modelKey: String!, $username: String!, $startTime: AWSDateTime!, $status: String!, $eventId: ID!, $eventName: String!) {
            createStartUploadToCarDbEntry(carFleetId: $carFleetId, carFleetName: $carFleetName, carInstanceId: $carInstanceId, carIpAddress: $carIpAddress, carName: $carName, jobId: $jobId, modelKey: $modelKey, username: $username, startTime: $startTime, status: $status, eventId: $eventId, eventName: $eventName) {
                carFleetId
                carFleetName
                carInstanceId
                carIpAddress
                carName
                eventId
                eventName
                jobId
                modelKey
                username
                startTime
                status
            }
        }
        """
        appsync_helpers.send_mutation(query, item)

    except Exception as error:
        logger.exception(error)
        return error

    return item
