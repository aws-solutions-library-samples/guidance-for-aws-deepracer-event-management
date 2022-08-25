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
        # TODO: Probably need to change this to a paging request so the frontend
        #       can send a request for the next page
        # TODO: Check the response back and handle appropriately

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
        # logger.info(response)

        return http_response.response(200, all_users)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)