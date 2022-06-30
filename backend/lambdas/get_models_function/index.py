import logging
import simplejson as json
import boto3
from datetime import date, datetime
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_s3 = boto3.client('s3')
bucket = os.environ["bucket"]

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

def lambda_handler(event, context):
    # function goes here
    
    response = client_s3.list_objects_v2(
        Bucket=bucket,
        Prefix='private/',
    )
    logger.info(response['Contents'])

    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': 200,
        'body': json.dumps(response['Contents'], default=json_serial)
    }
