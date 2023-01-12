#!/usr/bin/python3
# encoding=utf-8
import os
import uuid
from datetime import datetime

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

EVENTS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(EVENTS_DDB_TABLE_NAME)

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllFleets")
def getAllFleets():
    response = ddbTable.scan()
    logger.info(response)
    items = response["Items"]
    logger.info(items)
    return items


@app.resolver(type_name="Mutation", field_name="addFleet")
def addFleet(fleetName: str, carIds: list[str] = []):
    # TODO add regular expression for tag validation
    # TODO verify that the wanted tag is not already in use for another track
    fleetId = str(uuid.uuid4())
    createdAt = datetime.utcnow().isoformat() + "Z"
    item = {
        "fleetId": fleetId,
        "fleetName": fleetName,
        "createdAt": createdAt,
        "carIds": carIds,
    }
    response = ddbTable.put_item(Item=item)
    logger.info(f"ddb put response: {response}")
    logger.info(f"addFleet: response={item}")
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
def udpateFleet(fleetId: str, fleetName: str, carIds: list[str] = []):
    logger.info(f"udpateFleet: fleetId={fleetId}")

    response = ddbTable.update_item(
        Key={"fleetId": fleetId},
        UpdateExpression="SET fleetName= :newName, carIds= :carIds",
        ExpressionAttributeValues={
            ":newName": fleetName,
            ":carIds": carIds,
        },
        ReturnValues="ALL_NEW",
    )

    updatedFleet = response["Attributes"]
    return updatedFleet
