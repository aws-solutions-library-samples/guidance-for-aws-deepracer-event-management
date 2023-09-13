import json
import os

import boto3
import http_response
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
client = boto3.client("events")
eventbus_name = os.environ["eventbus_name"]


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
        logger.info(response)

        logger.info(event)
        return event

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)


@logger.inject_lambda_context
def post_confirmation_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.info(event)

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
                    "DetailType": "userConfirmed",
                    "Detail": json.dumps(detail),
                    "EventBusName": eventbus_name,
                },
            ]
        )
        logger.info(response)

        logger.info(event)
        return event
    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
