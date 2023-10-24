import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

EVENTS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)
client_ssm = boto3.client("ssm")


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext):
    result = {}
    try:
        instances = event["Instances"]["InstanceInformationList"]

        with ddbTable.batch_writer() as batch:
            for instance in instances:
                tags_response = client_ssm.list_tags_for_resource(
                    ResourceType="ManagedInstance",
                    ResourceId=instance["InstanceId"],
                )
                logger.debug(tags_response)

                # list of tags that we copy from SSM to DynamoBD table
                tag_keys_to_copy = [
                    "fleetName",
                    "fleetId",
                    "base64carUiPassword",
                    "Type",
                ]
                for tag in tags_response["TagList"]:
                    if tag["Key"] in tag_keys_to_copy:
                        instance[tag["Key"]] = tag["Value"]

                batch.put_item(Item=instance)

        result = {"NextToken": event["Instances"]["NextToken"]}
    except Exception as e:
        logger.exception(e)

    return result
