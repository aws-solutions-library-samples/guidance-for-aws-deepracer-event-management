import logging
import boto3
import os
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_s3 = boto3.client('s3')
infected_bucket = os.environ["infected_bucket"]


def lambda_handler(event, context):
    try:
        response = client_s3.list_objects_v2(
            Bucket=infected_bucket,
            Prefix='private/',
        )
        contents = []
        if 'Contents' in response:
            contents = response['Contents']
            logger.info(contents)

        return http_response.response(200, contents)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
