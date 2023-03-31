import os
import uuid
from datetime import datetime
from urllib.parse import unquote

import boto3
import http_response
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["DDB_TABLE"])


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.debug(json.dumps(event))

        file_status = event["responsePayload"]["status"]
        s3_object = event["requestPayload"]["Records"][0]["s3"]["object"]["key"]

        source_bucket = os.environ.get("MODELS_S3_BUCKET")
        dest_bucket = os.environ.get("INFECTED_S3_BUCKET")

        if file_status == "INFECTED":
            # cant move the file with the tag as INFECTED - update tag, then move
            response = s3.put_object_tagging(
                Bucket=source_bucket,
                Key=s3_object,
                Tagging={
                    "TagSet": [
                        {"Key": "scan-status", "Value": "MOVING-INFECTED"},
                    ]
                },
            )

            # copy the file from source to infected bucket
            s3.copy_object(
                Bucket=dest_bucket,
                CopySource={"Bucket": source_bucket, "Key": s3_object},
                Key=s3_object,
                Tagging="scan-status=INFECTED",
            )

            # delete original file
            s3.delete_object(Bucket=source_bucket, Key=s3_object)

            return http_response.response(200, {})

        elif file_status == "CLEAN":
            # Log to DynamoDB to kick off the MD5 process

            # Create the DyanmoDB entry
            item = {
                "modelId": str(uuid.uuid4()),
                "modelKey": unquote(s3_object),
                "uploadedDateTime": datetime.utcnow().isoformat() + "Z",
            }
            logger.debug(f"item: {item}")
            response = table.put_item(Item=item)
            logger.debug(response)

            return http_response.response(200, {})

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
