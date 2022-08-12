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
    if 'group' in event:
        group_name = event['group']
    else:
        group_name = "admin"

    # TODO: Probably need to change this to a paging request so the frontend
    #       can send a request for the next page
    # TODO: Check the response back and handle appropriately

    paginator = client_cognito.get_paginator('list_users_in_group')
    response_iterator = paginator.paginate(
        UserPoolId=user_pool_id,
        GroupName=group_name,
        PaginationConfig={
            'PageSize': 30,
        }
    )

    users = []
    for r in response_iterator:
        users.append(r['Users'])

    # Squash the list of lists
    all_users = [item for sublist in users for item in sublist]
    logger.info(all_users)

    return {
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS
        },
        "statusCode": 200,
        "body": json.dumps(all_users, default=json_serial)
    }
