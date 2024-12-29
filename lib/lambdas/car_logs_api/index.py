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

CAR_LOGS_ASSETS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
OPERATOR_ASSETS_GSI_NAME = os.environ["OPERATOR_ASSETS_GSI_NAME"]
ASSETS_BUCKET = os.environ["ASSETS_BUCKET"]

dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(CAR_LOGS_ASSETS_DDB_TABLE_NAME)

cloudwatch_events = boto3.client("events")

client_s3 = boto3.client("s3")

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


@app.resolver(type_name="Query", field_name="getAllCarLogsAssets")
def get_assets(user_sub: str = None, limit: int = 200, nextToken: dict = None):
    global identity
    try:
        if "claims" in identity and "cognito:username" in identity["claims"]:
            sub = identity["sub"]
        elif "userArn" in identity:
            sub = user_sub
        else:
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

        # Get all assets if the user is an operator or admin
        if __isUserOperatorOrAdmin(identity):
            query_settings["IndexName"] = OPERATOR_ASSETS_GSI_NAME
            logger.info(query_settings)
            response = ddbTable.scan(**query_settings)
            logger.info(response)
            table_items = response["Items"]

            sorted_table_items = sorted(
                table_items,
                key=lambda d: d["gsiUploadedTimestamp"],
                reverse=True,
            )
            nextToken = None
            if "LastEvaluatedKey" in response:
                nextToken = json.dumps(response["LastEvaluatedKey"])
            item = {"assets": sorted_table_items, "nextToken": nextToken}
            logger.info(item)
            return item

        # Get only the users own assets since user is not a privileged user
        query_settings["FilterExpression"] = Attr("type").eq("BAG_SQLITE") | Attr(
            "type"
        ).eq("VIDEO")
        query_settings["KeyConditionExpression"] = Key("sub").eq(sub)
        response = ddbTable.query(**query_settings)

        logger.info(response)
        assets = response["Items"]

        # Check if all items has been returned or if they where paginated
        nextToken = None
        if "LastEvaluatedKey" in response:
            nextToken = json.dumps(response["LastEvaluatedKey"])

        item = {"assets": assets, "nextToken": nextToken}
        logger.info(item)
        return item
    except Exception as error:
        logger.error(error)
        raise error


@app.resolver(type_name="Mutation", field_name="addCarLogsAsset")
def add_asset(**args):

    item = {**args}

    del item["sub"]
    del item["assetId"]

    # Make the assets available for operators via the operatorAssetsIndexV2 GSI
    item["gsiAvailableForOperator"] = "yes"
    item["gsiUploadedTimestamp"] = int(datetime.datetime.utcnow().timestamp() * 1000)

    ddb_update_expressions = dynamo_helpers.generate_update_query(item)

    logger.info(item)

    response = ddbTable.update_item(
        Key={"sub": args["sub"], "assetId": args["assetId"]},
        UpdateExpression=ddb_update_expressions["UpdateExpression"],
        ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
        ExpressionAttributeValues=ddb_update_expressions["ExpressionAttributeValues"],
        ReturnValues="ALL_NEW",
    )
    logger.info(response)

    return_obj = {
        **item,
        "assetId": args["assetId"],
        "sub": args["sub"],
    }

    logger.info(f"addCarLogsAsset item: {return_obj}")
    return return_obj


@app.resolver(type_name="Mutation", field_name="deleteCarLogsAsset")
def delete_asset(assetId: str, sub: str):
    global identity

    logger.info(f"Delete Asset: assetID={assetId}")

    # only allow the user to delete their own assets
    logger.info(f"Identity: {identity}, sub={sub}")

    identitySub = identity.get("sub")

    if identitySub == sub or identitySub is None or __isUserOperatorOrAdmin(identity):
        ddb_update_expressions = dynamo_helpers.generate_update_query(
            {"type": "NONE", "assetMetaData": {}}
        )

        # Clean up the operatorAssetsIndexV2 GSI attributes to
        # remove deleted assets from the operator view
        ddb_update_expressions["UpdateExpression"] = (
            ddb_update_expressions["UpdateExpression"]
            + " REMOVE gsiAvailableForOperator, gsiUploadedTimestamp"
        )

        response = ddbTable.update_item(
            Key={"sub": sub, "assetId": assetId},
            UpdateExpression=ddb_update_expressions["UpdateExpression"],
            ExpressionAttributeNames=ddb_update_expressions["ExpressionAttributeNames"],
            ExpressionAttributeValues=ddb_update_expressions[
                "ExpressionAttributeValues"
            ],
            ReturnValues="ALL_NEW",
        )
        logger.info(response)

        return response["Attributes"]
    else:
        raise Exception("User not authorized to delete this asset")


@app.resolver(type_name="Query", field_name="getCarLogsAssetsDownloadLinks")
def download_assets(assetSubPairs: list):
    global identity

    logger.info(f"Downloading Assets: {assetSubPairs}")

    assetLinks = []

    # only allow the user or operators or adminhs to download assets
    for asset in assetSubPairs:
        assetId = asset["assetId"]
        sub = asset["sub"]

        if sub == identity["sub"] or __isUserOperatorOrAdmin(identity):
            response = ddbTable.get_item(Key={"sub": sub, "assetId": assetId})
            logger.info(response)

            s3_key = response["Item"]["assetMetaData"]["key"]
            download_link = client_s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": ASSETS_BUCKET, "Key": s3_key},
                ExpiresIn=60,
            )
            assetLinks.append({"assetId": assetId, "downloadLink": download_link})

    if len(assetLinks) > 0:
        return assetLinks
    else:
        raise Exception("User not authorized to download these assets")
