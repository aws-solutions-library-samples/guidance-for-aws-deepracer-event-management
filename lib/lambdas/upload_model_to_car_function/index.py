import os
import re
from typing import Dict

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

client_ssm = boto3.client("ssm")
MODELS_S3_BUCKET = os.environ["MODELS_S3_BUCKET"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="uploadModelToCar")
def uploadModelToCar(entry: Dict[str, str]):
    try:
        carInstanceId = entry["carInstanceId"]
        modelKey = entry["modelKey"]
        username = entry.get("username", "default")

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
