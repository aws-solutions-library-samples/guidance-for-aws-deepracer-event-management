import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

session = boto3.session.Session()
region = session.region_name or "eu-west-1"

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllUsers")
def getAllUsers():
    try:
        # TODO: Probably need to change this to a paging request so the frontend
        #       can send a request for the next page

        paginator = client_cognito.get_paginator("list_users")
        response_iterator = paginator.paginate(
            UserPoolId=user_pool_id,
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

        # response = client_cognito.list_users(
        #     UserPoolId=user_pool_id,
        #     Limit=10
        # )
        # logger.info(json.dumps(response))

        return all_users

    except Exception as error:
        logger.exception(error)
        return error
