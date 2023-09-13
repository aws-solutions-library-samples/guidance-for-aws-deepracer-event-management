import appsync_helpers
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

client_cognito = boto3.client("cognito-idp")


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.info(event)

        username = event["detail"]["data"]["userName"]
        default_group_name = "racer"

        query = """mutation UpdateUser($roles: [String]!, $username: String!) {
            updateUser(roles: $roles, username: $username) {
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
            }
        }
        """

        appsync_helpers.send_mutation(
            query, {"roles": [default_group_name], "username": username}
        )

    except Exception as error:
        logger.exception(error)
        return error
