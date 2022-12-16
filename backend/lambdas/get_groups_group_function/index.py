from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
from botocore.exceptions import ClientError
import os
import http_response

logger = Logger()
client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        if event["pathParameters"] is None or not event["pathParameters"]["groupname"]:
            groupname = "admin"
        else:
            groupname = event["pathParameters"]["groupname"]

        # TODO: Probably need to change this to a paging request so the frontend
        #       can send a request for the next page

        try:
            paginator = client_cognito.get_paginator("list_users_in_group")
            response_iterator = paginator.paginate(
                UserPoolId=user_pool_id,
                GroupName=groupname,
                PaginationConfig={
                    "PageSize": 30,
                },
            )

            users = []
            for r in response_iterator:
                users.append(r["Users"])

            # Squash the list of lists
            all_users = [item for sublist in users for item in sublist]
            logger.info(all_users)

            return http_response.response(200, all_users)

        except ClientError as e:
            logger.exception(e.response)
            error_message = e.response["Error"]["Message"]
            http_status_code = e.response["ResponseMetadata"]["HTTPStatusCode"]
            return http_response.response(http_status_code, error_message)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
