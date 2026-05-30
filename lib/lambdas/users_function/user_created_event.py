import json
import os
import time

import appsync_helpers
import boto3
import http_response
import user_utils
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


def clean_json(obj):
    temp = json.dumps(obj, default=http_response.json_serial)  # sort out datetime
    temp2 = json.loads(temp)
    return temp2


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(event)
    username = event["detail"]["data"]["userName"]

    user = {
        "Username": username,
    }

    retries = 0
    while retries < 2:
        try:
            response = client_cognito.list_users(
                UserPoolId=user_pool_id,
                Limit=1,
                Filter='username = "{}"'.format(username),
            )
            if len(response["Users"]) == 0:
                retries += 1
                time.sleep(1)
            else:
                logger.info("user found in Cognito, break retries")
                break
        except Exception as e:
            logger.error(e)
            retries += 1

    if len(response["Users"]) == 1:
        user = clean_json(response["Users"][0])
        # extract sub and racerName to root level
        for attribute in user["Attributes"]:
            if attribute["Name"] == "sub":
                user["sub"] = attribute["Value"]
        user["racerName"] = user_utils.resolve_display_name(user)
        logger.info(user)

    query = """ mutation UserCreated(
        $Attributes: [UserObjectAttributesInput]
        $Enabled: Boolean
        $MFAOptions: [UsersObjectMfaOptionsInput]
        $UserCreateDate: AWSDateTime
        $UserLastModifiedDate: AWSDateTime
        $UserStatus: String
        $Username: String
        $sub: ID
        $racerName: String
    ) {
        userCreated(
        Attributes: $Attributes
        Enabled: $Enabled
        MFAOptions: $MFAOptions
        UserCreateDate: $UserCreateDate
        UserLastModifiedDate: $UserLastModifiedDate
        UserStatus: $UserStatus
        Username: $Username
        sub: $sub
        racerName: $racerName
        ) {
        Attributes {
            Name
            Value
        }
        Enabled
        MFAOptions {
            Name
            Value
        }
        Roles
        UserCreateDate
        UserLastModifiedDate
        UserStatus
        Username
        sub
        racerName
        }
    }
    """
    logger.info(user)
    appsync_helpers.send_mutation(query, user)
