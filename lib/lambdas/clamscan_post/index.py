#!/usr/bin/python3
# encoding=utf-8

import hashlib
import json
import os

import appsync_helpers
import boto3
from aws_lambda_powertools import Logger

logger = Logger()

session = boto3.session.Session()
client_s3 = boto3.client("s3")

DESTINATION_BUCKET = os.environ["DESTINATION_BUCKET"]
INFECTED_BUCKET = os.environ["INFECTED_BUCKET"]
BUCKET_OWNER = os.environ["BUCKET_OWNER"]


def copy_file(src_bucket, key, dest_bucket, dest_key):
    client_s3.copy_object(
        Bucket=dest_bucket,
        CopySource={"Bucket": src_bucket, "Key": key},
        Key=dest_key,
        ExpectedBucketOwner=BUCKET_OWNER,
        ExpectedSourceBucketOwner=BUCKET_OWNER,
    )


@logger.inject_lambda_context
def lambda_handler(event, context):
    logger.info(json.dumps(event))

    payload = event["detail"]["responsePayload"]

    key = payload["input_key"]
    src_bucket = payload["input_bucket"]
    status = payload["status"]

    model_key_cleaned = key.replace("%3A", ":")

    s3_key_parts = model_key_cleaned.split("/", 4)

    model_key_parts = s3_key_parts[4].split("/")

    sub = s3_key_parts[2]
    model_filename = model_key_parts[-1]
    model_key = f"private/{sub}/{model_filename}"
    model_id = hashlib.sha256(model_key.encode("utf-8")).hexdigest()

    query = """
      mutation UpdateModel(
        $modelId: ID!
        $status: ModelStatusEnum
        $sub: ID!
      ) {
        updateModel(
          modelId: $modelId
          status: $status
          sub: $sub
        ) {
          fileMetaData {
              filename
              key
              uploadedDateTime
          }
          modelId
          modelMD5
          modelMetaData {
              actionSpaceType
              metadataMd5
              sensor
              trainingAlgorithm
          }
          modelname
          status
          sub
          username
          }
      }
      """

    summary = {
        "source": "serverless-clamscan-upload",
        "input_bucket": src_bucket,
        "input_key": key,
        "input_status": status,
    }

    if status == "CLEAN":
        model_status = "AVAILABLE"
        copy_file(src_bucket, key, DESTINATION_BUCKET, model_key)

        appsync_helpers.send_mutation(
            query, {"modelId": model_id, "sub": sub, "status": model_status}
        )

        summary["status"] = model_status
        summary["target_bucket"] = DESTINATION_BUCKET
        summary["target_key"] = model_key

    else:
        model_status = status

    client_s3.delete_object(Bucket=src_bucket, Key=key)

    logger.info(summary)

    return summary
