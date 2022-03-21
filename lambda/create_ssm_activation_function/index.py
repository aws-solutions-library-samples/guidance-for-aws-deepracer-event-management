import logging
import simplejson as json
import boto3
import os
from botocore.exceptions import ClientError
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):

    logger.info(json.dumps(event))

    client = boto3.client('ssm')

    now = datetime.now()
    datestr = now.strftime("%Y-%m-%d-%H:%M")

    response = client.create_activation(
        Description='Hybrid activation for DREM',
        DefaultInstanceName='DREM Racer - '+datestr,
        IamRole='service-role/AmazonEC2RunCommandRoleForManagedInstances',
        RegistrationLimit=1,
        Tags=[
            {
                'Key': 'Name',
                'Value' : 'DREM Racer - '+datestr
            },
            {
                'Key': 'Type',
                'Value': 'deepracer'
            },
        ]
    )

    logger.info(response)

    status_code = 200

    return {
        'headers': {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS
        },
        'statusCode': status_code,
        'body': json.dumps(response)
    }
