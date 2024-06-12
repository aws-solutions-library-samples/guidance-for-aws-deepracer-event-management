import json
import os

import boto3
import http_response
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

session = boto3.session.Session()
region = session.region_name or "eu-west-1"

cognito_client = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


def clean_json(obj):
    temp = json.dumps(obj, default=http_response.json_serial)  # sort out datetime
    temp2 = json.loads(temp)
    return temp2


def __extract_user_attribute(user_attributes: list, attribute_name: str) -> str:
    for attribute in user_attributes:
        if attribute["Name"] == attribute_name:
            return attribute["Value"]


def __get_user(username: str) -> dict:
    response = cognito_client.list_users(
        UserPoolId=user_pool_id,
        Limit=1,
        Filter='username = "{}"'.format(username),
    )
    user = response["Users"][0]
    logger.info(user)
    user["sub"] = __extract_user_attribute(user["Attributes"], "sub")
    logger.info(user)
    return clean_json(user)


def __get_users() -> list:
    paginator = cognito_client.get_paginator("list_users")
    response_iterator = paginator.paginate(
        UserPoolId=user_pool_id,
        PaginationConfig={
            "PageSize": 60,
        },
        Filter='status = "Enabled"',
    )

    users = []
    for r in response_iterator:
        users.append(r["Users"])
        # send batch of results to appsync end point...

    # Squash the list of lists
    # Won't need to do this once we are sending
    # batches of results to appsync end point...
    all_users = [item for sublist in users for item in sublist]

    # pull "sub" out to top level of user object
    for user in all_users:
        user["sub"] = __extract_user_attribute(user["Attributes"], "sub")

    return all_users


def __get_group_memberships() -> dict[str, list[dict[str, str]]]:
    # Get available groups
    list_groups_response = cognito_client.list_groups(
        UserPoolId=user_pool_id,
    )
    groups = list_groups_response["Groups"]

    # Get users belonging to each of the available groups
    group_memberships = []
    for group in groups:
        group_name = group["GroupName"]
        #  paginator = cognito_client.get_paginator("list_users_in_group")
        #  response_iterator = paginator.paginate(
        #      UserPoolId=user_pool_id,
        #      GroupName=group_name,
        #      PaginationConfig={
        #          "PageSize": 60,
        #      },
        #  )
        users = []
        #  for r in response_iterator:
        #      users.append(r["Users"])

        members_in_group = [item for sublist in users for item in sublist]
        group_memberships.append({"GroupName": group_name, "Members": members_in_group})
    return group_memberships


def __add_roles_to_users(users, group_memberships):
    # TODO make this more efficient by grouping users by username

    for user in users:
        user_name = user["Username"]
        for group_membership in group_memberships:
            group_name = group_membership["GroupName"]
            for user_in_group in group_membership["Members"]:
                user_in_group = user_in_group["Username"]
                if user_name == user_in_group:
                    if "Roles" in user:
                        user["Roles"].append(group_name)
                    else:
                        user["Roles"] = [group_name]
    return users


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="listUsers")
def listUsers():
    # TODO: Probably need to change this to a paging request so the frontend
    #       can send a request for the next page

    # TODO fetch users and group memberships in parallel

    users = __get_users()
    group_memberships = __get_group_memberships()

    users_with_roles = __add_roles_to_users(users, group_memberships)

    return clean_json(users_with_roles)
    # return "submitted request"


@app.resolver(type_name="Mutation", field_name="createUser")
def create_user(username: str, email: str, countryCode: str):
    # check to see if user already exists
    userexists = False
    try:
        response = cognito_client.list_users(
            UserPoolId=user_pool_id,
            Limit=1,
            Filter='username = "{}"'.format(username),
        )
        logger.info(response)

        if len(response["Users"]) > 0:
            userexists = True
    except Exception as error:
        logger.exception(error)

    if userexists is False:
        user = cognito_client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "custom:countryCode", "Value": countryCode},
            ],
            DesiredDeliveryMediums=[
                "EMAIL",
            ],
        )

        logger.info(user["User"])
        return clean_json(user["User"])
    else:
        return {
            "error": {"message": "User Already Exists", "type": "UserAlreadyExists"}
        }


@app.resolver(type_name="Mutation", field_name="updateUser")
def updateUser(username: str, roles: list):
    all_groups = []

    try:
        response = cognito_client.list_groups(UserPoolId=user_pool_id, Limit=60)
        all_groups = response["Groups"]

    except Exception as error:
        logger.exception(error)
        raise Exception("Could not get existing groups")
    finally:
        __verify_group_to_assign_to_user_exist(roles, all_groups)

        # update users group assignment
        for group in all_groups:
            group_name = group["GroupName"]
            if group["GroupName"] in roles:
                __add_user_to_group(username, group_name)
            else:
                __remove_user_from_group(username, group_name)
        user = __get_user(username)

    return {**user, "Roles": roles}


def __add_user_to_group(username: str, group_name: str):
    try:
        response = cognito_client.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        logger.info(response)
    except Exception as error:
        logger.exception(error)
        raise Exception(f"Could not add user to group {group_name}")


def __remove_user_from_group(username: str, group_name: str):
    try:
        response = cognito_client.admin_remove_user_from_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        logger.info(response)
    except Exception as error:
        logger.exception(error)
        raise Exception(f"Could not remove user from group {group_name}")


def __verify_group_to_assign_to_user_exist(roles, all_groups):
    # verify that the group to assign the user to actually exists
    all_group_names = []
    for group in all_groups:
        all_group_names.append(group["GroupName"])

    for role in roles:
        logger.info(f"role: {role}, all_group_names: {all_group_names}")
        if role not in all_group_names:
            raise Exception(f"Role does {role} not exist")
