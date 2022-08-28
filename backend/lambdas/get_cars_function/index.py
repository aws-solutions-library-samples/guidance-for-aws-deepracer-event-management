from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import logging
import boto3
import http_response

logger = Logger()
client_ssm = boto3.client('ssm')


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        response = client_ssm.describe_instance_information(
            Filters=[
                {
                    'Key': 'PingStatus',
                    'Values': [
                        'Online',
                    ]
                },
            ],
        )
        logger.info(response['InstanceInformationList'])

        return http_response.response(200, response['InstanceInformationList'])

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
