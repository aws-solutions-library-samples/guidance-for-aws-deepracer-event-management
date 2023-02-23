import os

import http_response
import requests
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from requests_aws4auth import AWS4Auth

logger = Logger()

# Your AppSync Endpoint
api_endpoint = os.environ.get("graphqlUrl")

endpoint = os.environ.get("graphqlUrl", None)
headers = {"Content-Type": "application/json"}

access_id = os.environ.get("AWS_ACCESS_KEY_ID")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
session_token = os.environ.get("AWS_SESSION_TOKEN")
region = os.environ.get("AWS_REGION")

session = requests.Session()
auth = AWS4Auth(access_id, secret_key, region, "appsync", session_token=session_token)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    username = event["detail"]["data"]["userName"]
    email = event["detail"]["data"]["request"]["userAttributes"]["email"]
    # logger.info(username)

    try:
        # logger.info(event)

        # Use JSON format string for the query. It does not need reformatting.
        query = (
            '''
            mutation MyMutation {
                newUser(Username: "'''
            + username
            + '''",
                Attributes: [
                    {
                        Name: "email",
                        Value: "'''
            + email
            + """"
                    }
                ],
              ) {
                Username
              }
            }
        """
        )
        payload = {"query": query}

        try:
            response = requests.post(
                endpoint, auth=auth, json=payload, headers=headers
            ).json()
            if "errors" in response:
                logger.info("Error attempting to query AppSync")
                logger.info(response["errors"])
            else:
                logger.info(response)
                return response
        except Exception as exception:
            logger.info("Error with Mutation")
            logger.info(exception)

        return None

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
