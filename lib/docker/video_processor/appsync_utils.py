import boto3
import logging
import os
import requests
from botocore.credentials import InstanceMetadataProvider, InstanceMetadataFetcher
from requests_aws4auth import AWS4Auth

logger = logging.getLogger("appsync_utils.py")

# Get session
session = boto3.Session()
credentials = session.get_credentials().get_frozen_credentials()

# Create the AWS4Auth instance
region = os.environ.get("AWS_REGION")  # e.g., 'us-east-1'
auth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    region,
    "appsync",
    session_token=credentials.token,
)


def send_mutation(query, variables):
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
