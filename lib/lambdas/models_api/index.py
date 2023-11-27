import datetime
import os

import boto3
import dynamo_helpers
import simplejson as json
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Attr, Key

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

MODELS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
OPERATOR_MODELS_GSI_NAME = os.environ["OPERATOR_MODELS_GSI_NAME"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(MODELS_DDB_TABLE_NAME)

EVENT_BUS_NAME = os.environ["EVENT_BUS_NAME"]
cloudwatch_events = boto3.client("events")

client_s3 = boto3.client("s3")
bucket = os.environ["MODELS_S3_BUCKET"]

identity = {}


def __isUserOperatorOrAdmin(identity):
    if "groups" in identity and identity["groups"] is not None:
        groups = identity["groups"]
        if "operator" in groups or "admin" in groups:
            return True
    return False


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_method(capture_response=False)
def lambda_handler(event, context):
    global identity
    logger.info(event)
    identity = event["identity"]
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllModels")
def get_models(limit: int = 200, nextToken: dict = None):
    global identity
    try:
        sub = identity["sub"]

        logger.debug(f"limit: {limit}, nextToken: {nextToken}")

        query_settings = {
            "Limit": limit,
        }

        # Check if this is a continuation on an earlier pagination request
        try:
            nextTokenDict = json.loads(nextToken)
            if nextToken is not None:
                if len(nextTokenDict) > 0:
                    query_settings["ExclusiveStartKey"] = nextTokenDict
        except Exception as error:
            logger.warn(f"nextToken is not proper JSON, {error}")

        # Get all models if the user is an operator or admin
        if __isUserOperatorOrAdmin(identity):
            query_settings["IndexName"] = OPERATOR_MODELS_GSI_NAME
            logger.info(query_settings)
            response = ddbTable.scan(**query_settings)
            logger.info(response)
            table_items = response["Items"]

            sorted_table_items = sorted(
                table_items,
                key=lambda d: d["fileMetaData"]["uploadedDateTime"],
                reverse=True,
            )
            nextToken = None
            if "LastEvaluatedKey" in response:
                nextToken = json.dumps(response["LastEvaluatedKey"])
            item = {"models": sorted_table_items, "nextToken": nextToken}
            logger.info(item)
            return item

        # Get only the users own models since user is not a privileged user
        query_settings["FilterExpression"] = (
            Attr("status").eq("UPLOADED")
            | Attr("status").eq("AVAILABLE")
            | Attr("status").eq("NOT_VALID")
        )
        query_settings["KeyConditionExpression"] = Key("sub").eq(sub)
        response = ddbTable.query(**query_settings)

        logger.info(response)
        models = response["Items"]

        # Check if all items has been returned or if they where paginated
        nextToken = None
        if "LastEvaluatedKey" in response:
            nextToken = json.dumps(response["LastEvaluatedKey"])

        item = {"models": models, "nextToken": nextToken}
        logger.info(item)
        return item
    except Exception as error:
        logger.error(error)
        raise error


@app.resolver(type_name="Mutation", field_name="addModel")
def add_model(**args):
    # the S3 key is always unique, but a file with the same name might be
    # uploaded again by the user.
    # therefor the function is using ddb update item and not put_item
    item = {**args}

    del item["sub"]
    del item["modelId"]

    # Make the model available for operators via the operatorAvailableModelsIndex GSI
    item["gsiAvailableForOperator"] = "yes"
    item["gsiUploadedTimestamp"] = int(datetime.datetime.utcnow().timestamp() * 1000)

    ddb_update_expressions = dynamo_helpers.generate_update_query(item)

    logger.info(item)

    response = ddbTable.update_item(
        Key={"sub": args["sub"], "modelId": args["modelId"]},
        UpdateExpression=ddb_update_expressions["UpdateExpression"],
        ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
        ExpressionAttributeValues=ddb_update_expressions["ExpressionAttributeValues"],
        ReturnValues="ALL_NEW",
    )
    logger.info(response)

    return_obj = {
        **item,
        "modelId": args["modelId"],
        "sub": args["sub"],
    }
    evbEvent = {
        "Detail": json.dumps(return_obj),
        "DetailType": "modelAdded",
        "Source": "models-manager",
        "EventBusName": EVENT_BUS_NAME,
    }

    logger.info(__put_evb_events(evbEvent))

    logger.info(f"addModel item: {return_obj}")
    return return_obj


@app.resolver(type_name="Mutation", field_name="deleteModel")
def delete_model(modelId: str, sub: str):
    logger.info(f"Delete Model: modelId={modelId}")
    global identity

    # only allow the user to delete their own models
    logger.info(f"Identity: {identity}, sub={sub}")

    identitySub = identity.get("sub")

    if identitySub == sub or identitySub is None:
        ddb_update_expressions = dynamo_helpers.generate_update_query(
            {"status": "DELETED", "fileMetaData": {}}
        )

        # Clean up the operatorAvailableModelsIndex GSI attributes to
        # remove deleted models from the operator view
        ddb_update_expressions["UpdateExpression"] = (
            ddb_update_expressions["UpdateExpression"]
            + " REMOVE gsiAvailableForOperator, gsiUploadedTimestamp"
        )

        response = ddbTable.update_item(
            Key={"sub": sub, "modelId": modelId},
            UpdateExpression=ddb_update_expressions["UpdateExpression"],
            ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
            ExpressionAttributeValues=ddb_update_expressions[
                "ExpressionAttributeValues"
            ],
            ReturnValues="ALL_NEW",
        )
        logger.info(response)

        # evbEvent = {
        #     "Detail": json.dumps({"modelId": modelId}),
        #     "DetailType": "modelDeleted",
        #     "Source": "models-manager",
        #     "EventBusName": EVENT_BUS_NAME,
        # }

        # logger.info(__put_evb_events(evbEvent))

        return response["Attributes"]
    else:
        return {"error": "User not authorized to delete this model"}


@app.resolver(type_name="Mutation", field_name="updateModel")
def update_model(modelId, sub, **args):
    ddb_update_expressions = dynamo_helpers.generate_update_query({**args})

    response = ddbTable.update_item(
        Key={"sub": sub, "modelId": modelId},
        UpdateExpression=ddb_update_expressions["UpdateExpression"],
        ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
        ExpressionAttributeValues=ddb_update_expressions["ExpressionAttributeValues"],
        ReturnValues="ALL_NEW",
    )
    logger.info(response)

    evbEvent = {
        "Detail": json.dumps({**args, "modelId": modelId}),
        "DetailType": "modelUpdated",
        "Source": "models-manager",
        "EventBusName": EVENT_BUS_NAME,
    }

    logger.info(__put_evb_events(evbEvent))

    return response["Attributes"]


def __put_evb_events(evbEvent):
    return cloudwatch_events.put_events(Entries=[evbEvent])
