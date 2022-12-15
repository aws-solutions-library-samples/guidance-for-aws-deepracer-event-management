from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

import simplejson as json
import boto3
import os
import http_response
import tarfile
import hashlib
from urllib.parse import unquote
import uuid
from datetime import datetime

logger = Logger()

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["DDB_TABLE"])
bucket = os.environ["MODELS_S3_BUCKET"]


def md5_file(file):
    try:
        with open(file, "rb") as file_to_md5:
            data = file_to_md5.read()
            return hashlib.md5(data).hexdigest()
    except Exception as error:
        logger.exception(error)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(json.dumps(event))

    # Get the required data from the event json
    model_id = event["Records"][0]["dynamodb"]["Keys"]["modelId"]["S"]
    model_key = event["Records"][0]["dynamodb"]["NewImage"]["modelKey"]["S"]

    # Slice n dice
    model_key_parts = model_key.split("/")
    racer_identity_id = model_key_parts[1]
    racer_name = model_key_parts[2]
    model_filename = model_key_parts[-1]
    model_filename_parts = model_filename.split(".")
    model_name = model_filename_parts[0]

    # Get the MD5 of model elements and update the DB
    try:
        s3.download_file(bucket, model_key, f"/tmp/{model_filename}")
        tar = tarfile.open(f"/tmp/{model_filename}")
        tar.extractall(f"/tmp/{model_name}")
        tar.close()

        model_md5 = md5_file(f"/tmp/{model_name}/agent/model.pb")
        logger.debug(f"{model_name}/agent/model.pb MD5 => {model_md5}")

        model_metadata_md5 = md5_file(f"/tmp/{model_name}/model_metadata.json")
        logger.debug(f"{model_name}/model_metadata.json MD5 => {model_metadata_md5}")

        response = table.update_item(
            Key={
                "modelId": model_id,
            },
            UpdateExpression="SET racerName = :racerName, racerIdentityId = :racerIdentityId, md5Datetime = :md5Datetime, modelMD5 = :modelMD5, modelMetadataMD5 = :modelMetadataMD5",
            ExpressionAttributeValues={
                ":racerName": racer_name,
                ":racerIdentityId": racer_identity_id,
                ":md5Datetime": datetime.utcnow().isoformat() + "Z",
                ":modelMD5": model_md5,
                ":modelMetadataMD5": model_metadata_md5,
            },
        )
        logger.debug(response)

        # Return the MD5 for now
        return http_response.response(200)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
