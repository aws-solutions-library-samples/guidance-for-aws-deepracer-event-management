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

client_ssm = boto3.client("ssm")

JOBS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(JOBS_DDB_TABLE_NAME)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext):
    logger.info(event)
    logger.info(context)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="startFetchFromCar")
@tracer.capture_method
def startFetchFromCar(
    carInstanceId,
    carName,
    carFleetId,
    carFleetName,
    carIpAddress,
    eventId,
    eventName,
    laterThan,
    racerName,
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
        "laterThan": laterThan,
        "racerName": racerName,
        "jobId": jobId,
    }
    response = client.start_execution(
        stateMachineArn=step_function_arn, input=json.dumps(input)
    )
    logger.info(response)
    returnData = {"jobId": jobId}
    return returnData


@app.resolver(type_name="Query", field_name="listFetchesFromCar")
@tracer.capture_method
def listFetchesFromCar(jobId="0", eventId="0"):
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


@app.resolver(type_name="Mutation", field_name="createStartFetchFromCarDbEntry")
@tracer.capture_method
def createStartFetchFromCarDbEntry(
    jobId,
    carInstanceId,
    carName,
    carFleetId,
    carFleetName,
    carIpAddress,
    eventId,
    eventName,
    laterThan,
    racerName,
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
        "laterThan": laterThan,
        "racerName": racerName,
        "startTime": startTime,
        "status": status,
    }
    _ = ddbTable.put_item(Item=input)

    logger.info(f"Starting fetch from carInstanceId {carInstanceId}")

    return input


@app.resolver(type_name="Mutation", field_name="updateFetchFromCarDbEntry")
@tracer.capture_method
def updateFetchFromCarDbEntry(
    jobId,
    status,
    endTime,
    fetchStartTime,
    uploadKey,
):
    key = {
        "jobId": jobId,
    }
    updateValues = {":s": status}

    UpdateExpression = "set #s = :s"
    if endTime is not None:
        UpdateExpression = UpdateExpression + ", endTime=:e"
        updateValues[":e"] = endTime
    if fetchStartTime is not None:
        UpdateExpression = UpdateExpression + ", uploadStartTime=:u"
        updateValues[":u"] = fetchStartTime
    if uploadKey is not None:
        UpdateExpression = UpdateExpression + ", uploadKey=:k"
        updateValues[":k"] = uploadKey

    response = ddbTable.update_item(
        Key=key,
        UpdateExpression=UpdateExpression,
        ExpressionAttributeValues=updateValues,
        ExpressionAttributeNames={"#s": "status"},
        ReturnValues="UPDATED_NEW",
    )

    logger.info(response)
    logger.info(f"Updating job {jobId}")

    response = ddbTable.get_item(Key=key)
    return response.get("Item", {})


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)
