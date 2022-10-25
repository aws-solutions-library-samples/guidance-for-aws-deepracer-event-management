from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
import os
import http_response

logger = Logger()

client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        response = {}
        logger.info(response)

        return http_response.response(response['ResponseMetadata']['HTTPStatusCode'], response)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
