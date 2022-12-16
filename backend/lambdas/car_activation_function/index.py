#!/usr/bin/python3
# encoding=utf-8
import os
from datetime import datetime

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="carActivation")
def carActivation(hostname: str, fleetName: str, fleetId: str):
    try:
        client = boto3.client("ssm")
        now = datetime.now()
        datestr = now.strftime("%Y-%m-%d-%H:%M")

        response = client.create_activation(
            Description="Hybrid activation for DREM",
            DefaultInstanceName=hostname + " - " + datestr,
            IamRole="service-role/AmazonEC2RunCommandRoleForManagedInstances",
            RegistrationLimit=1,
            Tags=[
                {"Key": "Name", "Value": hostname + " - " + datestr},
                {"Key": "Type", "Value": "deepracer"},
                {"Key": "fleetName", "Value": fleetName},
                {"Key": "fleetId", "Value": fleetId},
            ],
        )

        return_data = {
            "region": region,
            "activationCode": response["ActivationCode"],
            "activationId": response["ActivationId"],
        }

        logger.info(return_data)

        return return_data

    except Exception as error:
        logger.exception(error)
        return error
