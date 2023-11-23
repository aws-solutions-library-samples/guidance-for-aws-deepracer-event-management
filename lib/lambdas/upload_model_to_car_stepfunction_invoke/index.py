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
MODELS_S3_BUCKET = os.environ["MODELS_S3_BUCKET"]


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    modelKey = event["data"]["modelKey"]
    eventId = event["data"]["eventId"]

    logger.info(f"Start - JobId: {jobId}, modelKey: {modelKey}")

    item_started = {
        "jobId": jobId,
        "modelKey": modelKey,
        "status": "Started",
        "uploadStartTime": scalar_types_utils.aws_datetime(),
        "eventId": eventId,
    }

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
        appsync_helpers.send_mutation(query, item_started)

    except Exception as error:
        logger.exception(error)
        return error

    ## SSM code here
    try:
        carInstanceId = event["data"]["carInstanceId"]
        modelKey = event["data"]["modelKey"]
        username = event["data"]["username"]

        logger.info(carInstanceId)
        logger.info(modelKey)

        username = re.sub("[^0-9a-zA-Z-]+", "", username)
        filename = re.sub("[^0-9a-zA-Z-_.]+", "", modelKey.split("/")[-1])
        foldername = "{}-{}".format(username, filename.split(".")[0])

        # Generate a presigned URL for the S3 object
        s3_client = boto3.client("s3")
        try:
            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": MODELS_S3_BUCKET, "Key": modelKey},
                ExpiresIn=300,
            )
            logger.info(presigned_url)
        except ClientError as e:
            logger.error(e)

        # generate command to run on car with ssm
        extract_command = "zxvf"
        if modelKey.endswith(".tar"):
            extract_command = "xvf"

        response = client_ssm.send_command(
            InstanceIds=[carInstanceId],
            DocumentName="AWS-RunShellScript",
            Parameters={
                "commands": [
                    "curl '{0}' -s --output /tmp/{1}".format(presigned_url, filename),
                    "rm -rf /opt/aws/deepracer/artifacts/{0}/".format(foldername),
                    "mkdir -p /opt/aws/deepracer/artifacts/{0}/".format(foldername),
                    "tar "
                    + extract_command
                    + " /tmp/{0} -C /opt/aws/deepracer/artifacts/{1}/".format(
                        filename, foldername
                    ),
                    "rm /tmp/{0}".format(filename),
                    "mv /opt/aws/deepracer/artifacts/{0}/agent/model.pb"
                    " /opt/aws/deepracer/artifacts/{0}/model.pb".format(foldername),
                    "md5sum /opt/aws/deepracer/artifacts/{0}/model.pb | awk '{{ print"
                    " $1 }}' > /opt/aws/deepracer/artifacts/{0}/checksum.txt".format(
                        foldername
                    ),
                ]
            },
        )
        command_id = response["Command"]["CommandId"]
        logger.info(command_id)

        return {
            "carInstanceId": carInstanceId,
            "modelKey": modelKey,
            "ssmCommandId": command_id,
        }

    except Exception as error:
        logger.exception(error)
        return error
