#!/usr/bin/python3
# encoding=utf-8
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.event_handler import AppSyncResolver
import boto3
import simplejson as json
#import os
from datetime import date, datetime

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

logger = Logger()
client_ssm = boto3.client('ssm')


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)

@app.resolver(type_name="Query", field_name="carsOnline")
def carOnline():
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
        #logger.info(response['InstanceInformationList'])
        
        for resource in response['InstanceInformationList']:
            tags_response = client_ssm.list_tags_for_resource(
                ResourceType='ManagedInstance',
                ResourceId=resource['InstanceId'],
            )
            #logger.info(tags_response)
            #resource['TagList']=tags_response['TagList']
            
            for tag in tags_response['TagList']:
                if tag['Key'] == 'eventName':
                    resource['eventName']=tag['Value']
                elif tag['Key'] == 'eventId':
                    resource['eventId']=tag['Value']
            resource['IsLatestVersion']=str(resource['IsLatestVersion'])

            data = {
            "InstanceId": resource["InstanceId"],
            "PingStatus": resource["PingStatus"],
            "LastPingDateTime": resource["LastPingDateTime"].isoformat(),
            "AgentVersion": resource["AgentVersion"],
            "IsLatestVersion": resource["IsLatestVersion"],
            "PlatformType": resource["PlatformType"],
            "PlatformName": resource["PlatformName"],
            "PlatformVersion": resource["PlatformVersion"],
            "ActivationId": resource["ActivationId"],
            "IamRole": resource["IamRole"],
            "RegistrationDate": resource["RegistrationDate"].isoformat(),
            "ResourceType": resource["ResourceType"],
            "Name": resource["Name"],
            "IPAddress": resource["IPAddress"],
            "ComputerName": resource["ComputerName"],
            #"SourceId": resource["SourceId"],
            #"SourceType": resource["SourceType"],
            "eventId": resource["eventId"],
            "eventName": resource["eventName"],
            }
            return_array.append(data)
        
        logger.info(return_array)
        return return_array

    except Exception as error:
        logger.exception(error)
        return error
