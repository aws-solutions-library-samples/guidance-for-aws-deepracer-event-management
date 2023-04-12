import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

client_s3 = boto3.client("s3")
infected_bucket = os.environ["infected_bucket"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return app.resolve(event, context)


@app.resolver(type_name="Query", field_name="getQuarantinedModels")
def getQuarantinedModels():
    try:
        response = client_s3.list_objects_v2(
            Bucket=infected_bucket,
            Prefix="private/",
        )
        logger.info(response)
        quarantined_models = []

        for model in response.get("Contents", []):
            quarantined_models.append(
                {
                    "modelKey": model["Key"],
                    "uploadedDateTime": model["LastModified"].isoformat(),
                }
            )

        return quarantined_models

    except Exception as error:
        logger.exception(error)
        return error
