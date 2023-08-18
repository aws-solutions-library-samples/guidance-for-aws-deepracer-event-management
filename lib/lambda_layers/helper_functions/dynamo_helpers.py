import decimal

import boto3
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource("dynamodb")


def generate_update_query(fields, key_fields=[]):
    exp = {
        "UpdateExpression": "set",
        "ExpressionAttributeNames": {},
        "ExpressionAttributeValues": {},
    }
    ddb_attributes = replace_floats_with_decimal(fields)
    for key, value in ddb_attributes.items():
        if key not in key_fields:
            exp["UpdateExpression"] += f" #{key} = :{key},"
            exp["ExpressionAttributeNames"][f"#{key}"] = key
            exp["ExpressionAttributeValues"][f":{key}"] = value
    exp["UpdateExpression"] = exp["UpdateExpression"][0:-1]
    logger.info(exp)
    return exp


def replace_floats_with_decimal(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = replace_floats_with_decimal(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = replace_floats_with_decimal(obj[k])
        return obj
    elif isinstance(obj, float):
        return decimal.Decimal(obj).quantize(
            decimal.Decimal(".0001"), rounding=decimal.ROUND_DOWN
        )
    else:
        return obj


def replace_decimal_with_float(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = replace_decimal_with_float(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = replace_decimal_with_float(obj[k])
        return obj
    elif isinstance(obj, decimal.Decimal):
        return float(obj)
    else:
        return obj
