import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from appsync_helpers import send_mutation


tracer = Tracer()
logger = Logger()

# EVENTS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
# dynamodb = boto3.resource("dynamodb")
# ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)
client_ssm = boto3.client("ssm")


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext):
    result = {}
    try:
        instances = event["Instances"]["InstanceInformationList"]

        for instance in instances:
            # get SW version from SSM
            response = client_ssm.list_inventory_entries(
                InstanceId=instance["InstanceId"],
                TypeName="AWS:Application",
                Filters=[{"Key": "Name", "Values": ["aws-deepracer-core"]}],
            )
            logger.debug(response)

            instance["DeepRacerCoreVersion"] = "Unknown Version"
            for entry in response.get("Entries", []):
                if entry.get("Name") == "aws-deepracer-core":
                    instance["DeepRacerCoreVersion"] = entry.get(
                        "Version", "Unknown Version"
                    )
                    break

            instance["LoggingCapable"] = False
            try:
                version_str = instance["DeepRacerCoreVersion"].split("+")[0]
                version_parts = list(map(int, version_str.split(".")))
                if version_parts >= [2, 1, 2, 7]:
                    instance["LoggingCapable"] = True
            except ValueError:
                pass

            # get tags from SSM
            tags_response = client_ssm.list_tags_for_resource(
                ResourceType="ManagedInstance",
                ResourceId=instance["InstanceId"],
            )
            logger.debug(tags_response)

            # list of tags that we copy from SSM to DynamoBD table
            tag_keys_to_copy = [
                "fleetName",
                "fleetId",
                "DeviceUiPassword",
                "Type",
            ]
            for tag in tags_response["TagList"]:
                if tag["Key"] in tag_keys_to_copy:
                    instance[tag["Key"]] = tag["Value"]

            # delete all keys in instance containing 'Association'
            keys_to_delete = [
                key
                for key in instance.keys()
                if "Association" in key or "Source" in key
            ]
            for key in keys_to_delete:
                del instance[key]

        logger.info(instances)
        send_status_update(instances)

        if "NextToken" in event["Instances"]:
            result = {"result": "success", "NextToken": event["Instances"]["NextToken"]}
        else:
            result = {"result": "success"}

    except Exception as e:
        logger.exception(e)
        result = {"result": "error"}

    return result


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
