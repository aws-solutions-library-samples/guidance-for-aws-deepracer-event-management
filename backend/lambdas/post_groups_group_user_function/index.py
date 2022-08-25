import logging
import simplejson as json
import boto3
import os
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]


def lambda_handler(event, context):
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

        # TODO: Deal with the exceptions correctly
        # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/cognito-idp.html#CognitoIdentityProvider.Client.admin_add_user_to_group

        return http_response.response(200)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
