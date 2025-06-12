import datetime
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
s3_client = boto3.client("s3")

BAG_UPLOAD_S3_BUCKET = os.environ["BAG_UPLOAD_S3_BUCKET"]


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    jobId = event["data"]["jobId"]
    carName = event["data"]["carName"]
    carInstanceId = event["data"]["carInstanceId"]

    if event["data"].get("racerName") is not None:
        racerName = re.sub("[^0-9a-zA-Z-]+", "", event["data"].get("racerName"))
    else:
        racerName = ""

    if event["data"].get("laterThan") is not None:
        laterThan = event["data"]["laterThan"]
    else:
        laterThan = "1970-01-01T00:00:00Z"

    start_time = scalar_types_utils.aws_datetime()
    start_time_filename = time.strftime(
        "%Y%m%d-%H%M%S", datetime.datetime.now().timetuple()
    )

    filename = f"{carName}_{start_time_filename}"
    key = "/".join(["upload", filename + ".tar.gz"])

    logger.info(f"Start - JobId: {jobId}, carName: {carName}")

    item_started = {
        "jobId": jobId,
        "status": "REQUESTED_UPLOAD",
        "fetchStartTime": start_time,
        "uploadKey": key,
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
                    racerName
                    startTime
                    fetchStartTime
                    status
                    endTime
                    uploadKey
            }
        }
        """
        result = appsync_helpers.send_mutation(query, item_started)
        if not result:
            raise Exception("Failed to update the status of the job")

    except Exception as error:
        logger.exception(error)
        return error

    ## SSM code here
    try:

        # Generate a presigned URL for the S3 object
        try:
            presigned_url = s3_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": BAG_UPLOAD_S3_BUCKET, "Key": key},
                ExpiresIn=300,
            )
            logger.info(presigned_url)
        except ClientError as e:
            logger.error(e)

        response = client_ssm.send_command(
            InstanceIds=[carInstanceId],
            DocumentName="AWS-RunShellScript",
            Parameters={
                "commands": [
                    "#!/bin/bash",
                    "export HOME=/root",
                    "source /opt/aws/deepracer/lib/setup.bash",
                    "ros2 service call /logging_pkg/stop_logging std_srvs/srv/Trigger",
                    'logs_folder=$(ros2 param get /logging_pkg/bag_log_node output_path --hide-type --no-daemon) || { logs_folder="/opt/aws/deepracer/logs"; echo "Using default path - $logs_folder"; }',
                    "echo Using folder $logs_folder",
                    "# Find folders created after the given time point and add them to a tar file",
                    f"cd $logs_folder",
                    f'find . -mindepth 1 -maxdepth 1 -type d -newermt "{laterThan}" -name "{racerName}*" -exec tar -rvf /tmp/{filename}.tar {{}} +',
                    f"[ -e /tmp/{filename}.tar ] || tar -cvf /tmp/{filename}.tar --files-from /dev/null",
                    f"gzip /tmp/{filename}.tar",
                    f"curl -X PUT -T /tmp/{filename}.tar.gz '{presigned_url}'",
                    f"rm /tmp/{filename}.tar.gz",
                ]
            },
        )
        command_id = response["Command"]["CommandId"]
        logger.info(command_id)

        return {
            "carInstanceId": carInstanceId,
            "ssmCommandId": command_id,
            "uploadKey": key,
        }

    except Exception as error:
        logger.exception(error)
        raise error
