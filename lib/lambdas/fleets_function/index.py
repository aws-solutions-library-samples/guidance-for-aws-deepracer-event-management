#!/usr/bin/python3
# encoding=utf-8
import json
import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

EVENTS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)
client_events = boto3.client("events")
eventbus_name = os.environ["eventbus_name"]

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)

sub = ""


def post_eventbridge_carsUpdate_event(
    fleetId: str, fleetName: str, carIds: list[str]
) -> bool:
    try:
        detail = {
            "metadata": {
                "service": "fleets",
                "domain": "DREM",
            },
            "data": {"fleetId": fleetId, "fleetName": fleetName, "carIds": carIds},
        }
        logger.info(detail)

        response = client_events.put_events(
            Entries=[
                {
                    "Source": "fleets",
                    "DetailType": "carsUpdate",
                    "Detail": json.dumps(detail),
                    "EventBusName": eventbus_name,
                },
            ]
        )
        logger.info(response)
        return True

    except Exception as error:
        logger.exception(error)
        return False


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

    post_eventbridge_carsUpdate_event(fleetId, fleetName, carIds)
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
        UpdateExpression="SET fleetName= :newName",
        ExpressionAttributeValues={
            ":newName": fleetName,
            ":carIds": carIds,
        },
        ReturnValues="ALL_NEW",
    )

    post_eventbridge_carsUpdate_event(fleetId, fleetName, carIds)

    updatedFleet = response["Attributes"]
    return updatedFleet
