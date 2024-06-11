import json
import os

import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
client = boto3.client("events")
ssm = boto3.client("ssm")
eventbus_name = os.environ["eventbus_name"]

session = boto3.session.Session()
region = session.region_name or "eu-west-1"

cognito_client = boto3.client("cognito-idp")
default_user_group = os.environ.get("default_user_group")
default_user_group_role_ev = os.environ.get("default_user_group_role_parameter")

default_user_group_role = None


@logger.inject_lambda_context
def pre_token_generation_handler(event: dict, context: LambdaContext) -> str:

    global default_user_group_role
    if default_user_group_role is None:
        logger.debug("loading default_user_group_role from SSM")
        default_user_group_role = ssm.get_parameter(Name=default_user_group_role_ev)
        logger.debug(default_user_group_role)

    if len(event["request"]["groupConfiguration"]["groupsToOverride"]) == 0:
        try:
            response = cognito_client.admin_add_user_to_group(
                UserPoolId=event.get("userPoolId"),
                Username=event.get("userName"),
                GroupName=default_user_group,
            )
            logger.debug(response)
        except Exception as error:
            logger.exception(error)
            raise Exception(f"Could not add user to group {default_user_group}")

        event["response"]["claimsOverrideDetails"] = {
            "groupOverrideDetails": {
                "groupsToOverride": [
                    default_user_group,
                ],
                "iamRolesToOverride": [default_user_group_role["Parameter"]["Value"]],
                "preferredRole": default_user_group_role["Parameter"]["Value"],
            }
        }
    return event


@logger.inject_lambda_context
def pre_sign_up_handler(event: dict, context: LambdaContext) -> str:
    try:
        detail = {
            "metadata": {
                "service": "cognito",
                "domain": "DREM",
            },
            "data": event,
        }

        response = client.put_events(
            Entries=[
                {
                    "Source": "idp",
                    "DetailType": "userCreated",
                    "Detail": json.dumps(detail),
                    "EventBusName": eventbus_name,
                },
            ]
        )
        return event

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
