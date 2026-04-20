#!/usr/bin/python3
# encoding=utf-8
"""getPdfJob resolver Lambda.

Reads a PdfJob row, enforces per-job auth (creator or admin/operator/
commentator), and returns a fresh pre-signed URL when status == SUCCESS.
"""
import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths

import shared

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

PDF_JOBS_TABLE = os.environ["PDF_JOBS_TABLE"]
URL_EXPIRY_SECONDS = int(os.environ.get("URL_EXPIRY_SECONDS", "3600"))

_dynamodb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_jobs_table = _dynamodb.Table(PDF_JOBS_TABLE)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    logger.info(event)
    return app.resolve(event, context)


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
