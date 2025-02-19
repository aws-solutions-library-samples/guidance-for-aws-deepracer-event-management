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
    carInstanceId = event["data"]["carInstanceId"]
    ssmCommandId = event["data"]["ssm"]["ssmCommandId"]
    eventId = event["data"]["eventId"]

    logger.info(f"Updating status for JobId: {jobId}")

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
        logger.debug(result)
        ssmCommandStatus = result["Status"]

        systemStatus = "WAITING_FOR_UPLOAD"
        if ssmCommandStatus == "Success":
            logger.info(result["StandardOutputContent"])
            if "StandardErrorContent" in result:
                logger.info(result["StandardErrorContent"])
            systemStatus = "UPLOADED"
        elif ssmCommandStatus in ["InProgress", "Pending", "Delayed"]:
            systemStatus = "WAITING_FOR_UPLOAD"
        else:
            systemStatus = "UPLOAD_FAILED"
            logger.info(result["StandardOutputContent"])
            logger.error(result["StandardErrorContent"])

        logger.info(
            f"Updated Stats - JobId: {jobId}, ssmStatus:"
            f" {ssmCommandStatus}, systemStatus: {systemStatus}",
        )

        item_completed = {
            "jobId": jobId,
            "status": systemStatus,
        }

        try:
            query = """mutation updateFetchFromCarDbEntry($jobId: ID!, $status: CarLogsFetchStatus!, $endTime: AWSDateTime, $fetchStartTime: AWSDateTime, $uploadKey: String) {
                updateFetchFromCarDbEntry(jobId: $jobId, status: $status, endTime: $endTime, fetchStartTime: $fetchStartTime, uploadKey: $uploadKey) {
                    carInstanceId
                    carName
                    carFleetId
                    carFleetName
                    carIpAddress
                    eventId
                    eventName
                    jobId
                    laterThan
                    startTime
                    fetchStartTime
                    status
                    endTime
                    uploadKey
                }
            }
            """
            response = appsync_helpers.send_mutation(query, item_completed)
            if not response:
                raise Exception("Error sending mutation")

        except Exception as error:
            logger.exception(error)
            raise error

        return {
            "jobId": jobId,
            "status": ssmCommandStatus,
            "ssmCommandId": ssmCommandId,
            "uploadKey": event["data"]["ssm"].get("uploadKey"),
            "eventId": eventId,
        }

    except Exception as error:
        logger.exception(error)
        raise error
