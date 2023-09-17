import os
import uuid
from datetime import datetime

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

MODELS_DDB_TABLE_NAME = os.environ["DDB_TABLE"]
dynamodb = boto3.resource("dynamodb")
ddbTable = dynamodb.Table(MODELS_DDB_TABLE_NAME)

session = boto3.session.Session()
credentials = session.get_credentials()
region = session.region_name or "eu-west-1"
graphql_endpoint = os.environ.get("APPSYNC_URL", None)


client_s3 = boto3.client("s3")
bucket = os.environ["MODELS_S3_BUCKET"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_method(capture_response=False)
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getAllModels")
def getAllModels():
    try:
        s3_response = client_s3.list_objects_v2(
            Bucket=bucket,
            Prefix="private/",
        )
        if "Contents" in s3_response:
            s3_contents = s3_response["Contents"]

            table_response = ddbTable.scan()
            table_items = table_response["Items"]

            sorted_table_items = sorted(
                table_items, key=lambda d: d["uploadedDateTime"], reverse=True
            )

            ddb_items_dict = {}
            for item in sorted_table_items:
                # Only take latest version if the file has been uploaded multiple times
                if item["modelKey"] not in ddb_items_dict:
                    ddb_items_dict[item["modelKey"]] = item

            merged_items = []
            for s3_model in s3_contents:
                s3_key = s3_model["Key"]

                if s3_key in ddb_items_dict:
                    merged_items.append(ddb_items_dict[s3_key])

            return merged_items

    except Exception as error:
        logger.exception(error)


@app.resolver(type_name="Query", field_name="getModelsForUser")
def getModelsForUser(racerName: str):
    response = ddbTable.query(
        IndexName="racerNameIndex",
        Select="ALL_PROJECTED_ATTRIBUTES",
        KeyConditionExpression=Key("racerName").eq(racerName),
    )
    logger.info(response)
    items = response["Items"]
    logger.info(items)
    return items


@app.resolver(type_name="Mutation", field_name="addModel")
def addModel(
    modelKey: str,
    racerName: str,
    racerIdentityId: str,
):
    logger.info(
        f"addModel: modelKey={modelKey}, racerName={racerName},"
        f" racerIdentityId={racerIdentityId}"
    )
    item = {
        "modelId": str(uuid.uuid4()),
        "modelKey": modelKey,
        "racerName": racerName,
        "racerIdentityId": racerIdentityId,
        "uploadedDateTime": datetime.utcnow().isoformat() + "Z",
        "modelFilename": modelKey.rsplit("/", 1)[1],
    }
    response = ddbTable.put_item(Item=item)
    logger.info(f"ddb put response: {response}")
    logger.info(f"addModel item: {item}")
    return item


@app.resolver(type_name="Mutation", field_name="deleteModel")
def deleteModel(modelId: str):
    logger.info(f"deleteModel: modelId={modelId}")
    response = ddbTable.delete_item(Key={"modelId": modelId})
    logger.info(response)
    return {"modelId": modelId}


@app.resolver(type_name="Mutation", field_name="updateModel")
def udpateModel(modelId: str, modelMD5: str, modelMetadataMD5: str):
    logger.info(
        f"udpateModel: modelId={modelId}, modelMD5={modelMD5},"
        f" modelMetadataMD5={modelMetadataMD5}"
    )

    ddbTable.update_item(
        Key={"modelId": modelId},
        UpdateExpression=(
            "SET md5Datetime= :md5DateTime, modelMD5= :modelMD5, modelMetadataMD5="
            " :modelMetadataMD5"
        ),
        ExpressionAttributeValues={
            ":md5Datetime": datetime.utcnow().isoformat() + "Z",
            ":modelMD5": modelMD5,
            ":modelMetadataMD5": modelMetadataMD5,
        },
        ReturnValues="UPDATED_NEW",
    )
    return {"modelId": modelId}
