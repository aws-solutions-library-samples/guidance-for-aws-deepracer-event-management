import os

import requests
from aws_lambda_powertools import Logger
from requests_aws4auth import AWS4Auth

access_id = os.environ.get("AWS_ACCESS_KEY_ID")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
session_token = os.environ.get("AWS_SESSION_TOKEN")
region = os.environ.get("AWS_REGION")

logger = Logger()

auth = AWS4Auth(access_id, secret_key, region, "appsync", session_token=session_token)


def send_mutation(query, variables):
    logger.info(variables)
    """Triggers a mutation on the Appsync API to trigger a subscription"""

    endpoint = os.environ.get("APPSYNC_URL", None)
    headers = {"Content-Type": "application/json"}

    payload = {
        "query": query,
        "variables": variables,
    }
    logger.info(payload)
    try:
        logger.info("posting mutation!!")
        response = requests.post(
            endpoint, auth=auth, json=payload, headers=headers
        ).json()
        logger.info(f"mutation response: {response}")
        if "errors" in response:
            logger.error("Error attempting to publish to AppSync")
            logger.error(response["errors"])
        else:
            return response
    except Exception as exception:
        logger.exception("Error with Mutation")
        logger.exception(exception)
    return None
