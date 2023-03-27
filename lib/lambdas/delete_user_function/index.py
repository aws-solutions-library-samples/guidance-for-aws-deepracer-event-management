import json
import os

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]

# add event bus
client = boto3.client("events")
eventbus_name = os.environ["eventbus_name"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:

    return_data = {
        "Deleted": False,
        "Username": "",
    }

    try:
        # get the username from the provided JWT
        username = event["identity"]["username"]

        # if user["UserAttributes"][0]["Name"] == "sub":
        logger.info("user is logged in and exists (delete user!)")
        response = client_cognito.admin_delete_user(
            UserPoolId=user_pool_id, Username=username
        )
        logger.info(response)

        return_data["Deleted"] = True
        return_data["Username"] = username

        # put event into event bus that user deleted
        detail = {
            "metadata": {
                "service": "cognito",
                "domain": "DREM",
            },
            "data": event,
        }

        e_response = client.put_events(
            Entries=[
                {
                    "Source": "user",
                    "DetailType": "userDeleted",
                    "Detail": json.dumps(detail),
                    "EventBusName": eventbus_name,
                },
            ]
        )
        logger.info(e_response)

        # logger.info(return_data)
        return return_data
    except Exception as error:
        logger.exception(error)
        return error
