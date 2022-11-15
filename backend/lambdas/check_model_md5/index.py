from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

import simplejson as json
import boto3
import os
import http_response
import tarfile
import hashlib

logger = Logger()

s3 = boto3.resource("s3")
bucket = os.environ["MODELS_S3_BUCKET"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.debug(json.dumps(event))

        model_key = "private/eu-west-1:00000000-0000-0000-0000-000000000000/default/models/sample-model-steering-penalty.tar.gz"
        model_key_parts = model_key.split("/")
        model_filename = model_key_parts[-1]
        racer_name = model_key_parts[2]
        model_filename_parts = model_filename.split(".")
        model_name = model_filename_parts[0]

        try:
            s3.meta.client.download_file(bucket, model_key, f"/tmp/{model_filename}")

            tar = tarfile.open(f"/tmp/{model_filename}")
            tar.extractall(f"/tmp/{model_name}")
            tar.close()

            model_file = f"/tmp/{model_name}/agent/model.pb"
            with open(model_file, "rb") as file_to_check:
                data = file_to_check.read()
                model_md5 = hashlib.md5(data).hexdigest()

            logger.debug(f"{model_name}/agent/model.pb MD5 => {model_md5}")

            metadata_file = f"/tmp/{model_name}/model_metadata.json"
            with open(metadata_file, "rb") as file_to_check:
                data = file_to_check.read()
                metadata_md5 = hashlib.md5(data).hexdigest()

            logger.debug(f"{model_name}/model_metadata.json MD5 => {metadata_md5}")

            # Return the MD5 for now
            return http_response.response(
                200,
                {
                    "model_filename": model_filename,
                    "model_md5": model_md5,
                    "model_metadata_md5": metadata_md5,
                    "racer_name": racer_name,
                },
            )

        except Exception as error:
            logger.exception(error)
            return http_response.response(500, error)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
