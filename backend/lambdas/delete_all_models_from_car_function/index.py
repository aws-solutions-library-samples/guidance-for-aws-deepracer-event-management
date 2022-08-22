import logging
import simplejson as json
import boto3
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')

def lambda_handler(event, context):
    # function goes here
    logger.info(json.dumps(event))

    body_parameters=json.loads(event['body'])
    instance_id=body_parameters['InstanceId']
    
    #empty the artifacts folder
    logger.info(instance_id)

    status_code = 200

    response = client_ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={'commands': [
            "rm -rf /opt/aws/deepracer/artifacts/*"
        ]}
    )
    command_id = response['Command']['CommandId']
    logger.info(command_id)
    
    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': status_code,
        'body': json.dumps(command_id)
    }
