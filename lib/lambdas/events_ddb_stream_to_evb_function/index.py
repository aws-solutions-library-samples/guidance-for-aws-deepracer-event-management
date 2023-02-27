#!/usr/bin/python3
import json
import os
from decimal import Decimal

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from boto3.dynamodb.types import TypeDeserializer

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

td = TypeDeserializer()

EVENT_BUS_NAME = os.environ["EVENT_BUS_NAME"]
cloudwatch_events = boto3.client("events")


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)

    evbEvents = []
    for record in event["Records"]:
        detail_type = ""
        eventName = record["eventName"]
        if "INSERT" in eventName:
            detail_type = "eventAdded"
            detail = record["dynamodb"]["NewImage"]
        elif "MODIFY" in eventName:
            detail_type = "eventUpdated"
            detail = record["dynamodb"]["NewImage"]
        elif "REMOVE" in eventName:
            detail_type = "eventDeleted"
            detail = record["dynamodb"]["Keys"]

        detail_normal_json = __convertDdbJsonToNormalJson(detail)
        logger.info(detail_normal_json)
        detail_normal_json = __replace_decimal_with_float(detail_normal_json)
        logger.info(detail_normal_json)

        evbEvents.append(
            {
                "Detail": json.dumps(detail_normal_json),
                "DetailType": detail_type,
                "Source": "events-manager",
                "EventBusName": EVENT_BUS_NAME,
            }
        )
        logger.info(__put_evb_events(evbEvents))
    return {}  # TODO add error handling success response


def __convertDdbJsonToNormalJson(event):
    return {k: td.deserialize(v) for k, v in event.items()}


def __put_evb_events(evbEvents):
    return cloudwatch_events.put_events(Entries=evbEvents)


def __replace_decimal_with_float(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = __replace_decimal_with_float(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = __replace_decimal_with_float(obj[k])
        return obj
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj
