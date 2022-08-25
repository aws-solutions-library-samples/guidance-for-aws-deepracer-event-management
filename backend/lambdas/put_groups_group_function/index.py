import logging
import boto3
import os
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]


def lambda_handler(event, context):
    try:
        response = {}
        logger.info(response)

        return http_response.response(200)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
