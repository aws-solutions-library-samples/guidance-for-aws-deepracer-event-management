import hashlib

import appsync_helpers
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(json.dumps(event))

    asset_key_cleaned = (event["detail"]["object"]["key"]).replace("%3A", ":")

    # Slice n dice
    s3_key_parts = asset_key_cleaned.split("/")

    sub = s3_key_parts[1]
    type = s3_key_parts[2]

    if type == "videos":
        key_end = s3_key_parts[3]
    elif type == "logs":
        # For logs we only delete the entry when the metadata.yaml is deleted
        if s3_key_parts[4] == "metadata.yaml":
            key_end = s3_key_parts[3]
        else:
            logger.info("Not deleting logs entry as it is not the metadata.yaml.")
            return
    else:
        logger.warning("Unknown key part S3 key")
        return

    asset_key = f"private/{sub}/{type}/{key_end}"
    variables = {
        "assetId": hashlib.sha256(asset_key.encode("utf-8")).hexdigest(),
        "sub": sub,
    }

    logger.debug(variables)

    delete_query = """
      mutation DeleteCarLogsAsset(
        $assetId: ID!
        $sub: ID!
      ) {
        deleteCarLogsAsset(
          assetId: $assetId
          sub: $sub
        ) {
          assetId
          assetMetaData {
            key
            uploadedDateTime
          }
          sub
          type
          username
        }
      }
    """

    appsync_helpers.send_mutation(delete_query, variables)
