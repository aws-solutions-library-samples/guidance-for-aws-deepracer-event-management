"""IAM-signed AppSync requests. Used by the worker to call updatePdfJob."""
import os

import boto3
import requests
from aws_lambda_powertools import Logger
from requests_aws4auth import AWS4Auth

logger = Logger()

_ENDPOINT = os.environ.get("APPSYNC_ENDPOINT")
_REGION = os.environ.get("APPSYNC_REGION", "eu-west-1")


def _auth() -> AWS4Auth:
    """Build SigV4 auth from the Lambda's execution role credentials."""
    session = boto3.Session()
    creds = session.get_credentials().get_frozen_credentials()
    return AWS4Auth(
        creds.access_key,
        creds.secret_key,
        _REGION,
        "appsync",
        session_token=creds.token,
    )


def send_mutation(query: str, variables: dict) -> dict:
    """Send an IAM-signed GraphQL mutation. Returns the `data` block on success."""
    if not _ENDPOINT:
        raise RuntimeError("APPSYNC_ENDPOINT env var not set")
    response = requests.post(
        _ENDPOINT,
        auth=_auth(),
        json={"query": query, "variables": variables},
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    body = response.json()
    if body.get("errors"):
        messages = "; ".join(e.get("message", str(e)) for e in body["errors"])
        raise RuntimeError(f"AppSync returned errors: {messages}")
    return body.get("data", {})
