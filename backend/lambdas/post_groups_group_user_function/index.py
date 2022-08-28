from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import simplejson as json
import boto3
import os
import http_response

logger = Logger()
client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        post_data = json.loads(event['body'])
        if 'groupname' in event['pathParameters']:
            groupname = event['pathParameters']['groupname']
        if 'username' in event['body']:
            username = post_data['username']

        response = client_cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=groupname,
        )
        logger.info(response)

        return http_response.response(response['ResponseMetadata']['HTTPStatusCode'])

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
