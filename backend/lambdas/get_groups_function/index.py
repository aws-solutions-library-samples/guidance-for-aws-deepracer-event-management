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
        response = client_cognito.list_groups(
            UserPoolId=user_pool_id,
            Limit=60
        )
        logger.info(response)

        return http_response.response(200, response)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
