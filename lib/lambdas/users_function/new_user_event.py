# import os

# import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
# client = boto3.client("events")
# eventbus_name = os.environ["eventbus_name"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:

    try:
        logger.info(event)
        return "{}"

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
