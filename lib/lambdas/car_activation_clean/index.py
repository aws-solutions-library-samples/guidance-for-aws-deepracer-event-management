#!/usr/bin/python3
# encoding=utf-8
import json
from datetime import datetime

import boto3
import http_response
from aws_lambda_powertools import Logger

logger = Logger()

client = boto3.client("ssm")


def lambda_handler(event, context):
    try:
        paginator = client.get_paginator("describe_activations")
        response_iterator = paginator.paginate(
            PaginationConfig={
                "MaxResults": 50,
            },
        )

        now = datetime.now()
        expired_activations = []
        for response in response_iterator:
            for activation in response["ActivationList"]:
                # if activation is expired, delete it
                if activation["ExpirationDate"].isoformat() < now.isoformat():
                    expired_activations.append(activation)

        for activation in expired_activations:
            response = client.delete_activation(ActivationId=activation["ActivationId"])
            logger.info(
                json.dumps(activation, default=http_response.json_serial, indent=4)
            )

        return_data = {
            "expiredActivationsRemoved": len(expired_activations),
        }

        logger.info(return_data)

        return return_data

    except Exception as error:
        logger.exception(error)
        return error
