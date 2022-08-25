import logging
import boto3
import http_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client_ssm = boto3.client('ssm')


def lambda_handler(event, context):
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
