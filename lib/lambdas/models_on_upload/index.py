import hashlib

import appsync_helpers
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(json.dumps(event))

    # Get the required data from the event json
    model_key_cleaned = (event["detail"]["object"]["key"]).replace("%3A", ":")

    # Slice n dice
    s3_key_parts = model_key_cleaned.split("/", 4)
    model_key_parts = s3_key_parts[4].split("/")

    sub = s3_key_parts[2]
    username = s3_key_parts[3]
    model_filename = model_key_parts[-1]

    model_key = f"private/{sub}/{model_filename}"
    variables = {
        "sub": sub,
        "username": username,
        "modelId": hashlib.sha256(model_key.encode("utf-8")).hexdigest(),
        "modelname": model_filename.replace(".tar.gz", ""),
        "modelMD5": "",
        "fileMetaData": {
            "key": model_key,
            "filename": model_filename,
            "uploadedDateTime": scalar_types_utils.aws_datetime(),
        },
        "modelMetaData": {
            "actionSpaceType": None,
            "sensor": [],
            "trainingAlgorithm": None,
            "metadataMd5": None,
        },
        "status": "UPLOADED",
    }

    logger.info(f"variables => {variables}")

    query = """
     mutation AddModel(
        $fileMetaData: FileMetadataInput
        $modelId: ID!
        $modelname: String
        $modelMD5: String
        $modelMetaData: ModelMetadataInput
        $status: ModelStatusEnum!
        $sub: ID!
        $username: String!
      ) {
        addModel(
          fileMetaData: $fileMetaData
          modelId: $modelId
          modelname:  $modelname
          modelMD5: $modelMD5
          modelMetaData: $modelMetaData
          status: $status
          sub: $sub
          username: $username
        ) {
          fileMetaData {
            filename
            key
            uploadedDateTime
          }
          modelId
          modelname
          modelMD5
          modelMetaData {
            actionSpaceType
            sensor
            trainingAlgorithm
          }
          status
          sub
          username
        }
      }
      """

    appsync_helpers.send_mutation(query, variables)
