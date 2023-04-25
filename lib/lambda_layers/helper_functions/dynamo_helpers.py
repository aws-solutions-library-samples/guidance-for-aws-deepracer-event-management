import boto3
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource("dynamodb")


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
