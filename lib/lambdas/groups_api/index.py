#!/usr/bin/python3
# encoding=utf-8
import json
import os

import boto3
import http_response
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

cognito_client = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


def clean_json(obj):
    temp = json.dumps(obj, default=http_response.json_serial)  # sort out datetime
    temp2 = json.loads(temp)
    return temp2


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="listGroups")
def listGroups():
    # TODO implement pagination
    response = cognito_client.list_groups(UserPoolId=user_pool_id, Limit=60)
    logger.info(response)
    # TODO implement error handling
    response_item = []
    for group in response["Groups"]:
        response_item.append(
            {"GroupName": group["GroupName"], "Description": group["Description"]}
        )
    logger.info(response_item)
    return response_item


@app.resolver(type_name="Query", field_name="getGroupMembers")
def getGroupMembers(GroupName):

    # TODO: Probably need to change this to a paging request so the frontend
    #       can send a request for the next page

    paginator = cognito_client.get_paginator("list_users_in_group")
    response_iterator = paginator.paginate(
        UserPoolId=user_pool_id,
        GroupName=GroupName,
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


@app.resolver(type_name="Mutation", field_name="deleteUserFromGroup")
def deleteUserFromGroup(GroupName, Username):

    response = cognito_client.admin_remove_user_from_group(
        UserPoolId=user_pool_id,
        Username=Username,
        GroupName=GroupName,
    )
    logger.info(response)

    return {"Username": Username}


@app.resolver(type_name="Mutation", field_name="addUserToGroup")
def addUserToGroup(GroupName, Username):

    response = cognito_client.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=Username,
        GroupName=GroupName,
    )
    logger.info(response)

    return {"Username": Username}
