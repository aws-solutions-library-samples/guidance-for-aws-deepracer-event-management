#!/usr/bin/python3
# encoding=utf-8

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

client_ssm = boto3.client("ssm")


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getUploadModelToCarStatus")
def addEvent(carInstanceId: str, ssmCommandId: str):
    try:
        logger.info(carInstanceId)
        logger.info(ssmCommandId)

        instance_id = carInstanceId
        command_id = ssmCommandId

        result = client_ssm.get_command_invocation(
            CommandId=command_id,
            InstanceId=instance_id,
        )
        ssmCommandStatus = result["Status"]
        logger.info(ssmCommandStatus)

        return {
            "carInstanceId": carInstanceId,
            "ssmCommandId": ssmCommandId,
            "ssmCommandStatus": ssmCommandStatus,
        }

    except Exception as error:
        logger.exception(error)
        return error
