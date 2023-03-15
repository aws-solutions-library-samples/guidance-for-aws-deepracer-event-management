import base64
import json
import os

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

# DynamoBD
CARS_DDB_TABLE = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(CARS_DDB_TABLE)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(event)
    logger.debug(context)

    instance_id = event["instanceId"]

    try:
        # Get the car values
        ddb_response = ddbTable.get_item(Key={"InstanceId": instance_id})
        logger.debug(f"ddb_response: \n {ddb_response}")

        response_item = ddb_response["Item"]

        decoded_password = base64.b64decode(
            response_item.get("base64carUiPassword", "").encode("utf-8")
        ).decode("utf-8")

        label_info = {
            "device_hostname": response_item.get("ComputerName", "Not defined"),
            "device_password": decoded_password,
            "device_ipaddress": response_item.get("IpAddress", "Not defined"),
        }

        return json.dumps(label_info)

    except Exception as error:
        return str(error)
