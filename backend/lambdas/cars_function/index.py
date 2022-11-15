#!/usr/bin/python3
# encoding=utf-8
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.event_handler import AppSyncResolver
import boto3
import simplejson as json

# import os
from datetime import date, datetime
from typing import List

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

logger = Logger()
client_ssm = boto3.client("ssm")


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="carsOnline")
def carOnline(online: str):
    try:
        if online == False:
            PingStatusFilter = "ConnectionLost"
        else:
            PingStatusFilter = "Online"

        return_array = []

        next_token = ""

        while next_token is not None:
            if next_token == "":
                response = client_ssm.describe_instance_information(
                    Filters=[
                        {
                            "Key": "PingStatus",
                            "Values": [
                                PingStatusFilter,
                            ],
                        },
                    ],
                    MaxResults=50,
                )
            else:
                response = client_ssm.describe_instance_information(
                    Filters=[
                        {
                            "Key": "PingStatus",
                            "Values": [
                                PingStatusFilter,
                            ],
                        },
                    ],
                    MaxResults=50,
                    NextToken=next_token,
                )

            # logger.info(response['InstanceInformationList'])

            for resource in response["InstanceInformationList"]:
                tags_response = client_ssm.list_tags_for_resource(
                    ResourceType="ManagedInstance",
                    ResourceId=resource["InstanceId"],
                )
                # logger.info(tags_response)
                # resource['TagList']=tags_response['TagList']

                for tag in tags_response["TagList"]:
                    if tag["Key"] == "eventName":
                        resource["eventName"] = tag["Value"]
                    elif tag["Key"] == "eventId":
                        resource["eventId"] = tag["Value"]
                resource["IsLatestVersion"] = str(resource["IsLatestVersion"])

                data = {}

                # keys to check
                keys_to_check = [
                    "InstanceId",
                    "PingStatus",
                    "AgentVersion",
                    "IsLatestVersion",
                    "PlatformType",
                    "PlatformVersion",
                    "ActivationId",
                    "IamRole",
                    "ResourceType",
                    "Name",
                    "IPAddress",
                    "ComputerName",
                    "SourceId",
                    "SourceType",
                    "eventId",
                    "eventName",
                ]
                for current_key in keys_to_check:
                    if current_key in resource:
                        data[current_key] = resource[current_key]

                # keys to check and handle datetime objects
                keys_to_check = ["LastPingDateTime", "RegistrationDate"]
                for current_key in keys_to_check:
                    if current_key in resource:
                        data[current_key] = resource[current_key].isoformat()

                return_array.append(data)

            if "NextToken" in response:
                next_token = response["NextToken"]
                print("Next Token: {}".format(next_token))
                print("")
            else:
                break

        logger.info(return_array)
        return return_array

    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carUpdates")
def carUpdates(resourceIds: List[str], eventId: str, eventName: str):
    try:
        logger.info(resourceIds)

        for resource_id in resourceIds:
            response = client_ssm.add_tags_to_resource(
                ResourceType="ManagedInstance",
                ResourceId=resource_id,
                Tags=[
                    {"Key": "eventId", "Value": eventId},
                    {"Key": "eventName", "Value": eventName},
                ],
            )

            logger.info(response)
        return {"result": "success"}

    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Mutation", field_name="carDeleteAllModels")
def carDeleteAllModels(resourceIds: List[str]):
    try:
        logger.info(resourceIds)

        for instance_id in resourceIds:
            # empty the artifacts folder
            logger.info(instance_id)

            response = client_ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={
                    "commands": [
                        "rm -rf /opt/aws/deepracer/artifacts/*",
                        "rm -rf /root/.ros/log/*",
                    ]
                },
            )
            # command_id = response['Command']['CommandId']
            logger.info(response)

        return {"result": "success"}

    except Exception as error:
        logger.exception(error)
        return error
