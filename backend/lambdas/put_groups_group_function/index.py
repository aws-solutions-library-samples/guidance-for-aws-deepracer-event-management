import os

import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:

    try:
        response = {}
        http_response.info(response)

        return http_response.response(response["ResponseMetadata"]["HTTPStatusCode"])

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
