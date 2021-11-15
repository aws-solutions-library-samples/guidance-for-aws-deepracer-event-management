import logging
import simplejson as json
import boto3
from datetime import date, datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

def lambda_handler(event, context):
    # function goes here
    response = client_ssm.describe_instance_information()
    logger.info(response['InstanceInformationList'])

    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': 200,
        'body': json.dumps(response['InstanceInformationList'], default=json_serial)
        #'body': response
    }
