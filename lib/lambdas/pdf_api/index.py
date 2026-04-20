#!/usr/bin/python3
# encoding=utf-8
"""Orchestrator Lambda — AppSync resolver for generateRaceResultsPdf.

Writes a PENDING PdfJob row and invokes the worker Lambda async. Returns the
new job row to the caller immediately.
"""
import datetime as dt
import json
import os
import uuid

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

import shared

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

PDF_JOBS_TABLE = os.environ["PDF_JOBS_TABLE"]
WORKER_FUNCTION_NAME = os.environ["WORKER_FUNCTION_NAME"]
URL_EXPIRY_SECONDS = int(os.environ.get("URL_EXPIRY_SECONDS", "3600"))

_dynamodb = boto3.resource("dynamodb")
_lambda = boto3.client("lambda")
_s3 = boto3.client("s3")
_jobs_table = _dynamodb.Table(PDF_JOBS_TABLE)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="generateRaceResultsPdf")
def generate_race_results_pdf(eventId: str, type: str, userId: str = None, trackId: str = None):  # noqa: A002
    requester = shared.requester_identity((app.current_event.identity or {}))
    if type == "RACER_CERTIFICATE":
        if not userId:
            raise ValueError("userId is required for RACER_CERTIFICATE")
        shared.enforce_racer_self_service(requester, userId)

    job_id = str(uuid.uuid4())
    now = dt.datetime.utcnow()
    item = {
        "jobId": job_id,
        "status": "PENDING",
        "type": type,
        "eventId": eventId,
        "userId": userId,
        "trackId": trackId,
        "createdBy": requester["sub"],
        "createdAt": now.isoformat() + "Z",
        "ttl": int((now + dt.timedelta(days=1)).timestamp()),
    }
    _jobs_table.put_item(Item=item)
    _lambda.invoke(
        FunctionName=WORKER_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps({"jobId": job_id}),
    )
    return {**item, "downloadUrl": None, "error": None, "completedAt": None, "filename": None}


@app.resolver(type_name="Query", field_name="getPdfJob")
def get_pdf_job(jobId: str):
    requester = shared.requester_identity((app.current_event.identity or {}))
    resp = _jobs_table.get_item(Key={"jobId": jobId})
    item = resp.get("Item")
    if not item:
        return None
    if requester["sub"] != item.get("createdBy") and not (requester["groups"] & shared.ADMIN_GROUPS):
        raise PermissionError("Not your PDF job")

    result = shared.replace_decimal_with_float(item)
    result.setdefault("downloadUrl", None)
    result.setdefault("error", None)
    result.setdefault("completedAt", None)
    if item.get("status") == "SUCCESS" and item.get("s3Key") and item.get("filename"):
        result["downloadUrl"] = _s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": shared.PDF_BUCKET,
                "Key": item["s3Key"],
                "ResponseContentDisposition": f'attachment; filename="{item["filename"]}"',
            },
            ExpiresIn=URL_EXPIRY_SECONDS,
        )
    return result
