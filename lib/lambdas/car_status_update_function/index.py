import os
import time
from datetime import datetime, timedelta

import boto3
from appsync_helpers import send_mutation
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()
client_ssm = boto3.client("ssm")

UNKNOWN_VERSION = "Unknown Version"
MINIMUM_LOGGING_VERSION = [2, 1, 2, 7]


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext):
    result = {}
    start_time = time.time()

    try:
        logger.info(
            f"Processing {len(event['Instances']['InstanceInformationList'])} instances"
        )
        instances = event["Instances"]["InstanceInformationList"]

        update_instance_data = []
        for instance in instances:

            try:
                if instance["PingStatus"] == "Online":
                    # Get core version info and check logging capability
                    fetch_deepracer_core_version_and_check_logging(instance)

                    # Get and process tags
                    fetch_and_process_tags(instance)

                else:
                    # Skip any update if LastPingDateTime is more than 90 days in the past
                    last_ping = datetime.strptime(
                        instance["LastPingDateTime"], "%Y-%m-%dT%H:%M:%S.%fZ"
                    )
                    if datetime.utcnow() - last_ping > timedelta(days=90):
                        logger.info(
                            f"Instance {instance['InstanceId']} last pinged more than 90 days ago, skipping."
                        )
                        continue

                # Clean up instance data
                clean_instance_data(instance)

            except Exception as e:
                logger.warning(
                    f"Error processing instance {instance['InstanceId']}: {e}"
                )

            update_instance_data.append(instance)

        logger.info(update_instance_data)
        send_status_update(update_instance_data)

        if "NextToken" in event["Instances"]:
            result = {"result": "success", "NextToken": event["Instances"]["NextToken"]}
        else:
            result = {"result": "success"}

        logger.info(
            f"Successfully processed all instances in {time.time() - start_time:.2f} seconds"
        )
    except Exception as e:
        logger.exception(f"Error processing instances: {e}")
        result = {"result": "error", "message": str(e)}

    return result


def fetch_deepracer_core_version_and_check_logging(instance):
    """Fetch DeepRacer core version from SSM inventory and check logging capability."""
    # Set default values
    instance["DeepRacerCoreVersion"] = UNKNOWN_VERSION
    instance["LoggingCapable"] = False

    try:
        # Fetch version from inventory
        response = client_ssm.list_inventory_entries(
            InstanceId=instance["InstanceId"],
            TypeName="AWS:Application",
            Filters=[{"Key": "Name", "Values": ["aws-deepracer-core"]}],
        )
        logger.debug(response)

        # Process version information
        for entry in response.get("Entries", []):
            if entry.get("Name") == "aws-deepracer-core":
                version = entry.get("Version", UNKNOWN_VERSION)
                instance["DeepRacerCoreVersion"] = version

                # Check logging capability based on version
                if version != UNKNOWN_VERSION:
                    try:
                        version_str = version.split("+")[0]
                        version_parts = list(map(int, version_str.split(".")))
                        if version_parts >= MINIMUM_LOGGING_VERSION:
                            instance["LoggingCapable"] = True
                    except ValueError:
                        pass
                break
    except Exception as e:
        logger.warning(f"Error fetching DeepRacer core version: {e}")


def fetch_and_process_tags(instance):
    """Fetch and process tags from SSM."""
    tags_response = client_ssm.list_tags_for_resource(
        ResourceType=instance["ResourceType"],
        ResourceId=instance["InstanceId"],
    )
    logger.debug(tags_response)

    tag_keys_to_copy = [
        "fleetName",
        "fleetId",
        "DeviceUiPassword",
        "Type",
    ]
    for tag in tags_response["TagList"]:
        if tag["Key"] in tag_keys_to_copy:
            instance[tag["Key"]] = tag["Value"]


def clean_instance_data(instance):
    """Clean up instance data by keeping only the required fields."""
    # Define the list of fields to keep
    if instance.get("PingStatus") == "ConnectionLost":
        # For disconnected instances, only keep minimal information
        allowed_fields = [
            "InstanceId",
            "PingStatus",
            "LastPingDateTime",
            "ComputerName",
            "RegistrationDate",
        ]
    else:
        # For connected instances, keep all relevant fields
        allowed_fields = [
            "InstanceId",
            "PingStatus",
            "LastPingDateTime",
            "AgentVersion",
            "IsLatestVersion",
            "PlatformType",
            "PlatformName",
            "PlatformVersion",
            "ActivationId",
            "IamRole",
            "RegistrationDate",
            "ResourceType",
            "Name",
            "IpAddress",
            "ComputerName",
            "fleetId",
            "fleetName",
            "Type",
            "DeviceUiPassword",
            "DeepRacerCoreVersion",
            "LoggingCapable",
        ]

    # Get a list of keys to delete (keys that aren't in the allowed list)
    keys_to_delete = [key for key in list(instance.keys()) if key not in allowed_fields]

    # Delete all unwanted keys
    for key in keys_to_delete:
        del instance[key]


def send_status_update(instances):

    # Prepare the mutation
    mutation = """
    mutation carsUpdateStatus($cars: [carOnlineInput!]!) {
        carsUpdateStatus(cars: $cars) {
            InstanceId
            PingStatus
            LastPingDateTime
            AgentVersion
            IsLatestVersion
            PlatformType
            PlatformName
            PlatformVersion
            ActivationId
            IamRole
            RegistrationDate
            ResourceType
            Name
            IpAddress
            ComputerName
            fleetId
            fleetName
            Type
            DeviceUiPassword
            DeepRacerCoreVersion
            LoggingCapable
        }
    }
    """
    send_mutation(mutation, {"cars": instances})
