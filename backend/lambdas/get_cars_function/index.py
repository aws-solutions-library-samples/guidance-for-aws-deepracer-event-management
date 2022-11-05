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
        return_array=[]
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
        
        for resource in response['InstanceInformationList']:
            tags_response = client_ssm.list_tags_for_resource(
                ResourceType='ManagedInstance',
                ResourceId=resource['SourceId'],
            )
            #logger.info(tags_response)
            #resource['TagList']=tags_response['TagList']
            
            for tag in tags_response['TagList']:
                if tag['Key'] == 'eventName':
                    resource['eventName']=tag['Value']
                elif tag['Key'] == 'eventId':
                    resource['eventId']=tag['Value']
            
            return_array.append(resource)

        return http_response.response(200, return_array)

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
