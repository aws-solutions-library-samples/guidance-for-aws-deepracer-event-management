import json
import os
import re
import time

import appsync_helpers
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger()

client_ssm = boto3.client("ssm")


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    modelKey = event["data"]["modelKey"]
    carInstanceId = event["data"]["carInstanceId"]
    ssmCommandId = event["data"]["ssmCommandId"]["ssmCommandId"]
    eventId = event["data"]["eventId"]

    logger.info(f"Start - JobId: {jobId}, modelKey: {modelKey}")

    ## SSM code here
    try:
        logger.info(carInstanceId)
        logger.info(ssmCommandId)

        instance_id = carInstanceId
        command_id = ssmCommandId

        result = client_ssm.get_command_invocation(
            CommandId=command_id,
            InstanceId=instance_id,
        )
        logger.info(result)
        ssmCommandStatus = result["Status"]
        logger.info(ssmCommandStatus)

        logger.info(
            f"Updated Stats - JobId: {jobId}, modelKey: {modelKey}, status:"
            f" {ssmCommandStatus}"
        )

        item_completed = {
            "jobId": jobId,
            "modelKey": modelKey,
            "status": ssmCommandStatus,
            "eventId": eventId,
        }
        if ssmCommandStatus == "Success":
            item_completed["endTime"] = scalar_types_utils.aws_datetime()

        try:
            query = """mutation updateUploadToCarDbEntry($jobId: ID!, $modelKey: String!, $status: String!, $eventId: ID!, $endTime: AWSDateTime, $uploadStartTime: AWSDateTime) {
                updateUploadToCarDbEntry(jobId: $jobId, modelKey: $modelKey, status: $status, eventId: $eventId, endTime: $endTime, uploadStartTime: $uploadStartTime) {
                    jobId
                    modelKey
                    status
                    eventId
                    endTime
                    uploadStartTime
                }
            }
            """
            appsync_helpers.send_mutation(query, item_completed)

        except Exception as error:
            logger.exception(error)
            return error

        return item_completed

    except Exception as error:
        logger.exception(error)
        return error
