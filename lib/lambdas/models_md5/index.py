import hashlib
import os
import tarfile
from datetime import datetime
from tempfile import TemporaryDirectory

import boto3
import dynamo_helpers
import http_response
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["DDB_TABLE"])
bucket = os.environ["MODELS_S3_BUCKET"]


def md5_file(file):
    try:
        with open(file, "rb") as file_to_md5:
            data = file_to_md5.read()
            hashing_lib = hashlib.new("md5", usedforsecurity=False)
            hashing_lib.update(data)
            hex = hashing_lib.hexdigest()
            return hex
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

    item = {
        "racerName": racer_name,
        "racerIdentityId": racer_identity_id,
        "md5Datetime": datetime.utcnow().isoformat() + "Z",
        "modelMD5": None,
        "modelMetadataMD5": None,
        "sensor": None,
        "trainingAlgorithm": None,
        "actionSpaceType": None,
    }

    try:
        with TemporaryDirectory() as tmpdir:
            model_filename_full_path = os.path.join(tmpdir, model_filename)
            model_name_full_path = os.path.join(tmpdir, model_name)
            modelpb_path_name = os.path.join(model_name_full_path, "agent/model.pb")
            modelmeta_path_name = os.path.join(
                model_name_full_path, "model_metadata.json"
            )

            # Get the MD5 of model elements and update the DB
            s3.download_file(bucket, model_key, model_filename_full_path)
            tar = tarfile.open(model_filename_full_path)
            tar.extractall(model_name_full_path)
            tar.close()

            logger.info(os.listdir(model_name_full_path))
            # Get the MD5
            try:
                model_md5 = md5_file(modelpb_path_name)
                logger.debug(f"{modelpb_path_name} MD5 => {model_md5}")
                item["modelMD5"] = model_md5
            except Exception as error:
                logger.warn(error)

            try:
                model_metadata_md5 = md5_file(modelmeta_path_name)
                logger.debug(f"{modelmeta_path_name} MD5 => {model_metadata_md5}")
                item["modelMetadataMD5"] = model_metadata_md5
            except Exception as error:
                logger.warn(error)

            # Get sensor, training algorithm and action space from model_metadata.json
            try:
                with open(modelmeta_path_name) as json_file:
                    model_metadata_contents = json_file.read()

                logger.debug(f"model_metadata_content => {model_metadata_contents}")

                model_metadata_json = json.loads(model_metadata_contents)
                try:
                    item["sensor"] = model_metadata_json["sensor"]
                except Exception as error:
                    logger.warn(error)

                try:
                    item["trainingAlgorithm"] = model_metadata_json[
                        "training_algorithm"
                    ]
                except Exception as error:
                    logger.warn(error)

                try:
                    item["actionSpaceType"] = model_metadata_json["action_space_type"]
                except Exception as error:
                    logger.warn(error)
            except Exception as error:
                logger.warn(error)

            ddb_update_expressions = dynamo_helpers.generate_update_query(item)

            response = table.update_item(
                Key={
                    "modelId": model_id,
                },
                UpdateExpression=ddb_update_expressions["UpdateExpression"],
                ExpressionAttributeNames=ddb_update_expressions[
                    "ExpressionAttributeNames"
                ],
                ExpressionAttributeValues=ddb_update_expressions[
                    "ExpressionAttributeValues"
                ],
                ReturnValues="ALL_NEW",
            )
            logger.debug(response["Attributes"])

            # Return the MD5 for now
            return http_response.response(200)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
