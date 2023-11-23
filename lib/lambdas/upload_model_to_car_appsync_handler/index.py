import json
import os
import uuid

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

step_function_arn = os.environ["STEP_FUNCTION_ARN"]
client = boto3.client("stepfunctions")

JOBS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(JOBS_DDB_TABLE_NAME)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext):
    logger.info(event)
    logger.info(context)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="startUploadToCar")
@tracer.capture_method
def startUploadToCar(
    carInstanceId,
    carName,
    carFleetId,
    carFleetName,
    carIpAddress,
    eventId,
    eventName,
    modelData,
):
    jobId = str(uuid.uuid4())
    input = {
        "carInstanceId": carInstanceId,
        "carName": carName,
        "carFleetId": carFleetId,
        "carFleetName": carFleetName,
        "carIpAddress": carIpAddress,
        "eventId": eventId,
        "eventName": eventName,
        "modelData": modelData,
        "jobId": jobId,
    }
    response = client.start_execution(
        stateMachineArn=step_function_arn, input=json.dumps(input)
    )
    logger.info(response)
    returnData = {"jobId": jobId}
    return returnData


@app.resolver(type_name="Query", field_name="listUploadsToCar")
@tracer.capture_method
def listUploadsToCar(jobId="0", eventId="0"):
    if jobId != "0" and jobId is not None:
        logger.info("jobId" + jobId)
        response = ddbTable.query(KeyConditionExpression=Key("jobId").eq(jobId))
    elif eventId != "0" and eventId is not None:
        logger.info("eventId" + eventId)
        response = ddbTable.query(
            IndexName="eventId", KeyConditionExpression=Key("eventId").eq(eventId)
        )

    logger.info(response["Items"])
    return response["Items"]


@app.resolver(type_name="Mutation", field_name="createStartUploadToCarDbEntry")
@tracer.capture_method
def createStartUploadToCarDbEntry(
    jobId,
    carInstanceId,
    carName,
    carFleetId,
    carFleetName,
    carIpAddress,
    eventId,
    eventName,
    modelKey,
    username,
    startTime,
    status,
):
    input = {
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
    response = ddbTable.put_item(Item=input)

    logger.info(f"Starting model {modelKey} for carInstanceId {carInstanceId}")

    return input


@app.resolver(type_name="Mutation", field_name="updateUploadToCarDbEntry")
@tracer.capture_method
def updateUploadToCarDbEntry(
    jobId,
    modelKey,
    status,
    eventId,
    endTime,
    uploadStartTime,
):
    key = {
        "jobId": jobId,
        "modelKey": modelKey,
    }
    updateValues = {":s": status}

    UpdateExpression = "set #s = :s"
    if endTime is not None:
        UpdateExpression = UpdateExpression + ", endTime=:e"
        updateValues[":e"] = endTime
    if uploadStartTime is not None:
        UpdateExpression = UpdateExpression + ", uploadStartTime=:u"
        updateValues[":u"] = uploadStartTime

    response = ddbTable.update_item(
        Key=key,
        UpdateExpression=UpdateExpression,
        ExpressionAttributeValues=updateValues,
        ExpressionAttributeNames={"#s": "status"},
        ReturnValues="UPDATED_NEW",
    )

    logger.info(response)
    logger.info(f"Updating model {modelKey}")

    return_data = {
        "jobId": jobId,
        "modelKey": modelKey,
        "status": status,
        "uploadStartTime": uploadStartTime,
        "endTime": endTime,
        "eventId": eventId,
    }
    return return_data
