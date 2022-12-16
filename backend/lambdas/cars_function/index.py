from typing import List

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

logger = Logger()
client_ssm = boto3.client("ssm")


colors = {
    "blue": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 0},
    "red": {"blue_pwm": 0, "green_pwm": 0, "red_pwm": 9999825},
    "marigold": {"blue_pwm": 0, "green_pwm": 5097950, "red_pwm": 9999825},
    "orchid purple": {"blue_pwm": 5019520, "green_pwm": 0, "red_pwm": 5019520},
    "sky blue": {"blue_pwm": 9999825, "green_pwm": 5646960, "red_pwm": 1176450},
    "green": {"blue_pwm": 0, "green_pwm": 9882180, "red_pwm": 4862660},
    "violet": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 9999825},
    "lime": {"blue_pwm": 0, "green_pwm": 9999825, "red_pwm": 9999825},
}


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="carsOnline")
def carOnline(online: str):
    try:
        if online is False:
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
                    if tag["Key"] == "fleetName":
                        resource["fleetName"] = tag["Value"]
                    elif tag["Key"] == "fleetId":
                        resource["fleetId"] = tag["Value"]

                if "IsLatestVersion" in resource:
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
                    "fleetId",
                    "fleetName",
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
def carUpdates(resourceIds: List[str], fleetId: str, fleetName: str):
    try:
        logger.info(resourceIds)

        for resource_id in resourceIds:
            response = client_ssm.add_tags_to_resource(
                ResourceType="ManagedInstance",
                ResourceId=resource_id,
                Tags=[
                    {"Key": "fleetId", "Value": fleetId},
                    {"Key": "fleetName", "Value": fleetName},
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


@app.resolver(type_name="Mutation", field_name="carSetTaillightColor")
def carSetTaillightColor(resourceIds: List[str], selectedColor: str):
    try:
        logger.info(resourceIds)

        color = colors.get(selectedColor.lower())
        if color is None:
            color = colors.get("Blue")

        for instance_id in resourceIds:
            client_ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={
                    "commands": [
                        "#!/bin/bash",
                        'export HOME="/home/deepracer"',
                        "source /opt/ros/foxy/setup.bash",
                        "source /opt/intel/openvino_2021/bin/setupvars.sh",
                        "source /opt/aws/deepracer/lib/local_setup.bash",
                        (
                            "ros2 service call /servo_pkg/set_led_state"
                            ' deepracer_interfaces_pkg/srv/SetLedCtrlSrv "{red:'
                            f" {color['red_pwm']}, blue: {color['blue_pwm']}, green:"
                            f" {color['green_pwm']}}}\""
                        ),
                    ]
                },
            )
            return {"result": "success"}
    except Exception as error:
        logger.exception(error)
        return error


@app.resolver(type_name="Query", field_name="availableTaillightColors")
def availableTaillightColors():
    return list(colors.keys())
