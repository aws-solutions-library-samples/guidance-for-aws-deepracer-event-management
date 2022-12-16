import os
from ast import And

import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from botocore.exceptions import ClientError

logger = Logger()
client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        if event["pathParameters"] is None:
            return http_response.response(400, "bad input")

        path_parameters = event["pathParameters"]
        if not path_parameters["groupname"] or not path_parameters["username"]:
            return http_response.response(400, "bad input")

        groupname = path_parameters["groupname"]
        username = path_parameters["username"]

        try:
            response = client_cognito.admin_remove_user_from_group(
                UserPoolId=user_pool_id,
                Username=username,
                GroupName=groupname,
            )
            logger.info(response)

            return http_response.response(
                response["ResponseMetadata"]["HTTPStatusCode"], ""
            )

        except ClientError as e:
            logger.exception(e.response)
            error_message = e.response["Error"]["Message"]
            http_status_code = e.response["ResponseMetadata"]["HTTPStatusCode"]
            return http_response.response(http_status_code, error_message)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
