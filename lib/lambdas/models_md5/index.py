import hashlib
import os
import tarfile
from tempfile import TemporaryDirectory
from urllib.parse import unquote_plus

import appsync_helpers
import boto3
import http_response
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["DDB_TABLE"])


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

    bucket_info = event["detail"]

    input_bucket = bucket_info["bucket"]["name"]
    model_s3_key = unquote_plus(bucket_info["object"]["key"])

    # Slice n dice
    model_key_parts = model_s3_key.split("/")
    racer_identity_id = model_key_parts[1]
    model_filename = model_key_parts[-1]
    model_filename_parts = model_filename.split(".")
    model_name = model_filename_parts[0]

    try:
        with TemporaryDirectory() as tmpdir:
            model_filename_full_path = os.path.join(tmpdir, model_filename)
            model_name_full_path = os.path.join(tmpdir, model_name)
            modelpb_path_name = os.path.join(model_name_full_path, "agent/model.pb")
            modelmeta_path_name = os.path.join(
                model_name_full_path, "model_metadata.json"
            )

            # Get the MD5 of model elements and update the DB

            s3.download_file(input_bucket, model_s3_key, model_filename_full_path)
            tar = tarfile.open(model_filename_full_path)
            tar.extractall(model_name_full_path)
            tar.close()

            variables = {
                "modelId": hashlib.sha256(model_s3_key.encode("utf-8")).hexdigest(),
                "sub": racer_identity_id,
                "modelMetaData": {
                    "sensor": [],
                    "actionSpaceType": None,
                    "trainingAlgorithm": None,
                    "metadataMd5": None,
                },
            }

            # Get the model MD5
            try:
                model_md5 = md5_file(modelpb_path_name)
                logger.debug(f"{modelpb_path_name} MD5 => {model_md5}")
                variables["modelMD5"] = model_md5
            except Exception as error:
                logger.exception(error)

            # Get the metadata Md5
            try:
                model_metadata_md5 = md5_file(modelmeta_path_name)
                logger.debug(f"{modelmeta_path_name} MD5 => {model_metadata_md5}")
                variables["modelMetaData"]["metadataMd5"] = model_metadata_md5
            except Exception as error:
                logger.exception(error)

            # Get sensor, training algorithm and action space from model_metadata.json
            try:
                with open(modelmeta_path_name) as json_file:
                    model_metadata_contents = json_file.read()

                logger.debug(f"model_metadata_content => {model_metadata_contents}")
                model_metadata_json = json.loads(model_metadata_contents)
                variables["modelMetaData"]["sensor"] = model_metadata_json.get(
                    "sensor", "unknown"
                )
                variables["modelMetaData"]["actionSpaceType"] = model_metadata_json.get(
                    "action_space_type", "unknown"
                )
                variables["modelMetaData"][
                    "trainingAlgorithm"
                ] = model_metadata_json.get("training_algorithm", "unknown")
            except Exception as error:
                logger.exception(error)

            query = """
                mutation UpdateModel(
                    $modelId: ID!
                    $modelMD5: String
                    $modelMetaData: ModelMetadataInput
                    $sub: ID!
                ) {
                    updateModel(
                    modelId: $modelId
                    modelMD5: $modelMD5
                    modelMetaData: $modelMetaData
                    sub: $sub
                    ) {
                    fileMetaData {
                        filename
                        key
                        uploadedDateTime
                    }
                    modelId
                    modelMD5
                    modelMetaData {
                        actionSpaceType
                        metadataMd5
                        sensor
                        trainingAlgorithm
                    }
                    modelname
                    status
                    sub
                    username
                    }
                }
            """
            logger.info(variables)
            appsync_helpers.send_mutation(query, variables)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
