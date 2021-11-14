import uuid
import logging
import simplejson as json
import boto3
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')
bucket = os.environ["bucket"]

def lambda_handler(event, context):
    # function goes here
    logger.info(json.dumps(event))

    body_parameters=json.loads(event['body'])
    instance_id=body_parameters['InstanceId']
    key=body_parameters['key']
    logger.info(instance_id)
    logger.info(key)

    command = 'echo ' + bucket + ' ' + key

    response = client_ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={'commands': [command]}
    )
    command_id = response['Command']['CommandId']
    logger.info(command_id)
    #output = client_ssm.get_command_invocation(
    #    CommandId=command_id,
    #    InstanceId=instance_id,
    #)
    #logger.info(output)

    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': 200,
        'body': json.dumps(command_id)
    }
