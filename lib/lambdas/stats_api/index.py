#!/usr/bin/python3
# encoding=utf-8
"""
Stats API Lambda — AppSync resolver for stats queries.
Reads pre-computed stats from the StatsTable.
"""
import os

import boto3
import dynamo_helpers
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

STATS_TABLE_NAME = os.environ["STATS_TABLE"]
dynamodb = boto3.resource("dynamodb")
stats_table = dynamodb.Table(STATS_TABLE_NAME)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getGlobalStats")
def get_global_stats():
    response = stats_table.get_item(Key={"pk": "GLOBAL", "sk": "TOTALS"})
    item = response.get("Item")
    if not item:
        return None
    item = dynamo_helpers.replace_decimal_with_float(item)
    # Remove DynamoDB keys from response
    item.pop("pk", None)
    item.pop("sk", None)
    return item
