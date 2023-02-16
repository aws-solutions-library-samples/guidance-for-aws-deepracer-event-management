import os

# import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
# client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def pre_sign_up_handler(event: dict, context: LambdaContext) -> str:

    try:
        # response = client_cognito.list_groups(UserPoolId=user_pool_id, Limit=60)
        # logger.info(response)

        # return http_response.response(
        #     response["ResponseMetadata"]["HTTPStatusCode"], response
        # )

        logger.info(event)
        return True

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
