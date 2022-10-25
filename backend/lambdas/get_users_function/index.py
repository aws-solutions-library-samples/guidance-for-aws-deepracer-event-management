from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
import os
import simplejson as json
import http_response

logger = Logger()
client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        # TODO: Probably need to change this to a paging request so the frontend
        #       can send a request for the next page

        paginator = client_cognito.get_paginator('list_users')
        response_iterator = paginator.paginate(
            UserPoolId=user_pool_id,
            PaginationConfig={
                'PageSize': 30,
            }
        )

        users = []
        for r in response_iterator:
            users.append(r['Users'])

        # Squash the list of lists
        all_users = [item for sublist in users for item in sublist]
        logger.info(all_users)

        # response = client_cognito.list_users(
        #     UserPoolId=user_pool_id,
        #     Limit=10
        # )
        # logger.info(json.dumps(response))

        return http_response.response(200, all_users)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
