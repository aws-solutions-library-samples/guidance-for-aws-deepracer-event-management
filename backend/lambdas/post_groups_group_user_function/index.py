import logging
import simplejson as json
import boto3
import os
from datetime import date, datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_cognito = boto3.client('cognito-idp')
user_pool_id = os.environ["user_pool_id"]

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

def lambda_handler(event, context):
    # function goes here

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

    #TODO: Deal with the exceptions correctly
    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/cognito-idp.html#CognitoIdentityProvider.Client.admin_add_user_to_group

    return {
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS
        },
        "statusCode": 200
    }
