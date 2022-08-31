from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
import simplejson as json
import boto3
import os
from datetime import datetime
import http_response

logger = Logger()
region = os.environ['AWS_REGION']


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    try:
        logger.info(event)

        body_parameters = json.loads(event['body'])
        hostname = body_parameters['hostname']

        client = boto3.client('ssm')

        now = datetime.now()
        datestr = now.strftime("%Y-%m-%d-%H:%M")

        response = client.create_activation(
            Description='Hybrid activation for DREM',
            DefaultInstanceName=hostname + ' - ' + datestr,
            IamRole='service-role/AmazonEC2RunCommandRoleForManagedInstances',
            RegistrationLimit=1,
            Tags=[
                {
                    'Key': 'Name',
                    'Value': hostname + ' - ' + datestr
                },
                {
                    'Key': 'Type',
                    'Value': 'deepracer'
                },
            ]
        )

        response['region'] = region  # Add the region to the response
        logger.info(response)

        return http_response.response(200, response)

    except Exception as error:
        logger.error(error)
        return http_response.response(500, error)
