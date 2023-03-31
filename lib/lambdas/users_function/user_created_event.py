import datetime
import os

import boto3
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

client_cognito = boto3.client("cognito-idp")
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(event)

    username = event["detail"]["data"]["userName"]
    email = event["detail"]["data"]["request"]["userAttributes"]["email"]
    # Add a 'fake' timestamp of now to save having to make another call to Cognito.
    user_create_date = datetime.datetime.now().isoformat(timespec="milliseconds") + "Z"

    response = client_cognito.list_users(
        UserPoolId=user_pool_id,
        Limit=1,
        Filter='username = "{}"'.format(username),
    )
    if len(response["Users"]) == 1:
        user = response["Users"][0]
        logger.info(user)

        # pull "sub" out to top level of user object
        for attributes in user["Attributes"]:
            if attributes["Name"] == "sub":
                # logger.info(attributes["Value"])
                user["sub"] = attributes["Value"]
            elif attributes["Name"] == "email":
                # logger.info(attributes["Value"])
                user["email"] = attributes["Value"]

        query = (
            '''
            mutation MyMutation {
                userCreated(Username: "'''
            + user["Username"]
            + '''",
                UserCreateDate: "'''
            + user_create_date
            + '''",
                sub: "'''
            + user["sub"]
            + '''",
                Attributes: [
                    {
                        Name: "email",
                        Value: "'''
            + user["email"]
            + '''"
                    },
                    {
                        Name: "sub",
                        Value: "'''
            + user["sub"]
            + """"
                    }
                ],
              ) {
                Username,
                UserCreateDate,
                sub,
                Attributes {
                  Name
                  Value
                }
              }
            }
        """
        )
    else:
        query = (
            '''
            mutation MyMutation {
                userCreated(Username: "'''
            + username
            + '''",
                UserCreateDate: "'''
            + user_create_date
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
                Username,
                UserCreateDate
              }
            }
        """
        )

    try:
        # Use JSON format string for the query. It does not need reformatting.
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
