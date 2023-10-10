import hashlib

import appsync_helpers
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(json.dumps(event))

    model_key_cleaned = (event["detail"]["object"]["key"]).replace("%3A", ":")

    # Slice n dice
    s3_key_parts = model_key_cleaned.split("/")

    sub = s3_key_parts[1]
    model_filename = s3_key_parts[-1]

    model_key = f"private/{sub}/{model_filename}"
    variables = {
        "modelId": hashlib.sha256(model_key.encode("utf-8")).hexdigest(),
        "sub": sub,
    }

    logger.debug(variables)

    delete_query = """
      mutation DeleteModel(
        $modelId: ID!
        $sub: ID!
      ) {
        deleteModel(
          modelId: $modelId
          sub: $sub
        ) {
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

    appsync_helpers.send_mutation(delete_query, variables)
