import json
import os

import boto3
import botocore
import urllib3
from aws_lambda_powertools import Logger, Tracer

tracer = Tracer()
logger = Logger()

DDB_TABLE_NAME = os.environ["DDB_TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(DDB_TABLE_NAME)


http = urllib3.PoolManager()
SUCCESS = "SUCCESS"
FAILED = "FAILED"

sfn_client = boto3.client("stepfunctions")
lambda_client = boto3.client("lambda")


def lambda_handler(event, context):
    """Custom Resource to populate initial Virus definitions"""
    logger.info(event)

    event_type = event["RequestType"]
    logger.info(event_type)

    if event_type == "Create":
        try:
            leaderboard_configs = ddbTable.scan()
            logger.info(leaderboard_configs)
            if "Items" in leaderboard_configs:
                for leaderboard_config in leaderboard_configs["Items"]:
                    logger.info(leaderboard_config)
                    if (
                        "headerText" in leaderboard_config
                        or "footerText" in leaderboard_config
                    ):
                        eventId = leaderboard_config["eventId"]
                        sk = leaderboard_config["sk"]
                        logger.info(
                            f"Update leaderboard config with eventId: { eventId}, sk:"
                            f" {sk}"
                        )

                        updated_item = __update_item_to_new_data_model(
                            leaderboard_config
                        )

                        del updated_item["eventId"]
                        del updated_item["sk"]

                        ddb_update_expressions = generate_update_query(updated_item)
                        response = ddbTable.update_item(
                            Key={"eventId": eventId, "sk": sk},
                            UpdateExpression=ddb_update_expressions["UpdateExpression"],
                            ExpressionAttributeNames=ddb_update_expressions[
                                "ExpressionAttributeNames"
                            ],
                            ExpressionAttributeValues=ddb_update_expressions[
                                "ExpressionAttributeValues"
                            ],
                            ReturnValues="ALL_NEW",
                        )
                        logger.info(response)
                reason = "all items updated"
            else:
                reason = f"Nothing to do on {event_type}"
            return send(event, context, SUCCESS, {}, reason=reason)
        except botocore.exceptions.ClientError as e:
            logger.error(e)
            return send(event, context, FAILED, {}, reason=e["message"])
    else:
        reason = f"Nothing to do on {event_type}"
        logger.info(reason)
        return send(event, context, SUCCESS, {}, reason=reason)


def send(
    event,
    context,
    responseStatus,
    responseData,
    physicalResourceId=None,
    noEcho=False,
    reason=None,
):
    """Send response to CloudFormation"""
    responseUrl = event["ResponseURL"]
    logger.info(responseUrl)
    responseBody = {
        "Status": responseStatus,
        "Reason": reason
        or f"See the details in CloudWatch Log Stream: {context.log_stream_name}",
        "PhysicalResourceId": physicalResourceId or context.log_stream_name,
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": noEcho,
        "Data": responseData,
    }
    json_responseBody = json.dumps(responseBody)
    logger.info("Response body:")
    logger.info(json_responseBody)
    headers = {
        "content-type": "",
        "content-length": str(len(json_responseBody)),
    }
    try:
        response = http.request(
            "PUT", responseUrl, headers=headers, body=json_responseBody
        )
        logger.info(f"Status code: {response.status}")
    except Exception as e:
        logger.info(f"send(..) failed executing http.request(..): {e}")


def __update_item_to_new_data_model(item):
    logger.info(item)
    updated_item = {
        **item,
        "leaderBoardFooter": item["footerText"],
        "leaderBoardTitle": item["headerText"],
    }

    del updated_item["headerText"]
    del updated_item["footerText"]
    return updated_item


def generate_update_query(fields):
    exp = {
        "UpdateExpression": "set",
        "ExpressionAttributeNames": {},
        "ExpressionAttributeValues": {},
    }
    for key, value in fields.items():
        exp["UpdateExpression"] += f" #{key} = :{key},"
        exp["ExpressionAttributeNames"][f"#{key}"] = key
        exp["ExpressionAttributeValues"][f":{key}"] = value
    exp["UpdateExpression"] = exp["UpdateExpression"][0:-1]
    return exp
