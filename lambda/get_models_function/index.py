import uuid
import logging
import simplejson as json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    # function goes here
    unique_id = str(uuid.uuid4())
    logger.info(json.dumps(unique_id))

    return {
        'headers': { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*", # Required for CORS support to work
            "Access-Control-Allow-Credentials" : True # Required for cookies, authorization headers with HTTPS 
        },
        'statusCode': 200,
        'body': json.dumps(unique_id)
    }
