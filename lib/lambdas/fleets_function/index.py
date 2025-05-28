#!/usr/bin/python3
# encoding=utf-8
import json
import os

import boto3
from appsync_helpers import send_mutation
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

FLEETS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(FLEETS_DDB_TABLE_NAME)

sub = ""


def post_appsync_carsUpdate_call(
    fleetId: str, fleetName: str, carIds: list[str]
) -> bool:
    try:
        # GraphQL mutation
        mutation = """
        mutation CarsUpdateFleet($fleetId: String!, $fleetName: String!, $resourceIds: [String!]!) {
            carsUpdateFleet(fleetId: $fleetId, fleetName: $fleetName, resourceIds: $resourceIds) {
                            InstanceId
                            PingStatus
                            LastPingDateTime
                            AgentVersion
                            IsLatestVersion
                            PlatformType
                            PlatformName
                            PlatformVersion
                            ActivationId
                            IamRole
                            RegistrationDate
                            ResourceType
                            Name
                            IpAddress
                            ComputerName
                            fleetId
                            fleetName
                            Type
                            DeviceUiPassword
                            DeepRacerCoreVersion
                            LoggingCapable
            }
        }
        """

        # Variables for the mutation
        variables = {"fleetId": fleetId, "fleetName": fleetName, "resourceIds": carIds}

        # Send the mutation using the helper
        response = send_mutation(mutation, variables)
        if not response:
            logger.error("Failed to send carsUpdate mutation")
            return False

        return True

    except Exception as error:
        logger.exception(error)
        raise


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    global sub
    sub = event["identity"]["sub"]
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllFleets")
def getAllFleets():
    response = ddbTable.scan()
    logger.info(response)
    items = response["Items"]
    logger.info(items)
    return items


@app.resolver(type_name="Mutation", field_name="addFleet")
def addFleet(fleetName: str, carIds: list[str] = [], **args):
    # TODO add regular expression for tag validation
    # TODO verify that the wanted tag is not already in use for another track

    global sub
    fleetId = scalar_types_utils.make_id()
    createdAt = scalar_types_utils.aws_datetime()
    createdBy: str = sub

    item = {
        "fleetId": fleetId,
        "fleetName": fleetName,
        "createdAt": createdAt,
        "createdBy": createdBy,
        "carIds": carIds,
        **args,
    }
    response = ddbTable.put_item(Item=item)
    logger.info(f"ddb put response: {response}")
    logger.info(f"addFleet: response={item}")

    post_appsync_carsUpdate_call(fleetId, fleetName, carIds)
    return item


@app.resolver(type_name="Mutation", field_name="deleteFleets")
def deleteFleets(fleetIds: list[str]):
    logger.info(f"deleteFleets: fleetIds={fleetIds}")

    fleets = []
    for fleetId in fleetIds:
        response = ddbTable.delete_item(Key={"fleetId": fleetId})
        logger.info(response)
        fleets.append({"fleetId": fleetId})
    return fleets


@app.resolver(type_name="Mutation", field_name="updateFleet")
def updateFleet(fleetId: str, fleetName: str, carIds: list[str] = []):
    logger.info(f"updateFleet: fleetId={fleetId}")

    response = ddbTable.update_item(
        Key={"fleetId": fleetId},
        UpdateExpression="SET fleetName= :newName, carIds= :carIds",
        ExpressionAttributeValues={
            ":newName": fleetName,
            ":carIds": carIds,
        },
        ReturnValues="ALL_NEW",
    )

    post_appsync_carsUpdate_call(fleetId, fleetName, carIds)

    updatedFleet = response["Attributes"]
    return updatedFleet
