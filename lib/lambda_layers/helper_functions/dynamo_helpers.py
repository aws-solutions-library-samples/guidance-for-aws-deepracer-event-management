import decimal
import time

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


def batch_get_items(batch_keys):
    """
    Gets a batch of items from Amazon DynamoDB. Batches can contain keys from
    more than one table.

    When Amazon DynamoDB cannot process all items in a batch, a set of unprocessed
    keys is returned. This function uses an exponential backoff algorithm to retry
    getting the unprocessed keys until all are retrieved or the specified
    number of tries is reached.

    :param batch_keys: The set of keys to retrieve. A batch can contain at most 100
                       keys. Otherwise, Amazon DynamoDB returns an error.
    :return: The dictionary of retrieved items grouped under their respective
             table names.
    """
    tries = 0
    max_tries = 5
    sleepy_time = 1  # Start with 1 second of sleep, then exponentially increase.
    retrieved = {key: [] for key in batch_keys}
    while tries < max_tries:
        response = dynamodb.batch_get_item(RequestItems=batch_keys)
        # Collect any retrieved items and retry unprocessed keys.
        for key in response.get("Responses", []):
            retrieved[key] += response["Responses"][key]
        unprocessed = response["UnprocessedKeys"]
        if len(unprocessed) > 0:
            batch_keys = unprocessed
            unprocessed_count = sum(
                [len(batch_key["Keys"]) for batch_key in batch_keys.values()]
            )
            logger.info(
                "%s unprocessed keys returned. Sleep, then retry.", unprocessed_count
            )
            tries += 1
            if tries < max_tries:
                logger.info("Sleeping for %s seconds.", sleepy_time)
                time.sleep(sleepy_time)
                sleepy_time = min(sleepy_time * 2, 32)
        else:
            break

    return retrieved
