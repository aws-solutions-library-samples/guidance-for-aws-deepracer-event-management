import json
import os
from datetime import date, datetime

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


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))


def clean_json(obj):
    temp = json.dumps(obj, default=json_serial)  # sort out datetime
    temp2 = json.loads(temp)
    return temp2


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="listUsers")
def listUsers():
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
        # send batch of results to appsync end point...

    # Squash the list of lists
    # Won't need to do this once we are sending
    # batches of results to appsync end point...
    all_users = [item for sublist in users for item in sublist]
    # logger.info(all_users)

    # pull "sub" out to top level of user object
    for user in all_users:
        for attributes in user["Attributes"]:
            if attributes["Name"] == "sub":
                # logger.info(attributes["Value"])
                user["sub"] = attributes["Value"]

    return clean_json(all_users)
    # return "submitted request"


@app.resolver(type_name="Mutation", field_name="createUser")
def create_user(username: str, email: str):
    # check to see if user already exists
    try:
        response = client_cognito.list_users(
            UserPoolId=user_pool_id,
            AttributesToGet=[
                "username",
            ],
            Limit=1,
            Filter='username = "{}"'.format(username),
        )
        logger.info(response)
    except Exception as error:
        logger.exception(error)

    user = client_cognito.admin_create_user(
        UserPoolId=user_pool_id,
        Username=username,
        UserAttributes=[
            {"Name": "email", "Value": email},
        ],
        DesiredDeliveryMediums=[
            "EMAIL",
        ],
    )

    logger.info(user["User"])
    return clean_json(user["User"])
