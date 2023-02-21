# import os

# import boto3
import os

import http_response
import urllib3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from requests_aws4auth import AWS4Auth

logger = Logger()
# client = boto3.client("events")
# eventbus_name = os.environ["eventbus_name"]


access_id = os.environ.get("AWS_ACCESS_KEY_ID")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
session_token = os.environ.get("AWS_SESSION_TOKEN")
region = os.environ.get("AWS_REGION")

# Your AppSync Endpoint
# api_endpoint = os.environ.get("AppsyncConnectionString")
api_endpoint = (
    "https://jmuapsk5fveahflm2jdcumgy6u.appsync-api.eu-west-1.amazonaws.com/graphql"
)

resource = "appsync"

http = urllib3.PoolManager()
http.auth = AWS4Auth(
    access_id, secret_key, region, resource, session_token=session_token
)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:

    try:
        logger.info(event)

        # Use JSON format string for the query. It does not need reformatting.
        mutation = """
            mutation MyMutation {
                newUser(Username: "cognitotest00",
                Attributes: [
                    {
                        Name: "sub",
                        Value: "ffe5e8be-9a45-4eb2-acb8-af0353158ad6"
                    },
                    {
                        Name: "email",
                        Value: "askwith+cognitotest12@amazon.co.uk"
                    }
                ],
                Enabled: true,
                UserStatus: "FORCE_CHANGE_PASSWORD"
              ) {
                Username
                UserCreateDate
                UserLastModifiedDate
                Enabled
                UserStatus
                sub
              }
            }
        }}"""
        # Now we can simply post the request...
        response = http.request(
            url=APPSYNC_API_ENDPOINT_URL, method="POST", json={"mutation": mutation}
        )
        logger.info(response)
        return "{}"

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
