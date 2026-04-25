#!/usr/bin/python3
# encoding=utf-8
"""Worker Lambda — async PDF renderer. Invoked by the orchestrator with {"jobId": ...}.

Reads the PENDING row, renders the PDF, uploads to S3, and writes terminal
status (SUCCESS/FAILED) via the IAM-authed updatePdfJob mutation. The mutation
triggers the onPdfJobUpdated subscription the frontend is listening to.
"""
import datetime as dt
import os

import boto3
from aws_lambda_powertools import Logger, Tracer

import shared
import appsync_iam

tracer = Tracer()
logger = Logger()

PDF_JOBS_TABLE = os.environ["PDF_JOBS_TABLE"]

_dynamodb = boto3.resource("dynamodb")
_jobs_table = _dynamodb.Table(PDF_JOBS_TABLE)

_UPDATE_MUTATION = """
mutation UpdatePdfJob($jobId: ID!, $status: PdfJobStatus!, $s3Key: String, $filename: String, $error: String) {
  updatePdfJob(jobId: $jobId, status: $status, s3Key: $s3Key, filename: $filename, error: $error) {
    jobId
  }
}
"""


@tracer.capture_lambda_handler
def lambda_handler(event, context):
    job_id = event["jobId"]
    logger.append_keys(jobId=job_id)
    try:
        job = _jobs_table.get_item(Key={"jobId": job_id})["Item"]
    except KeyError:
        logger.error("Job row not found — nothing to do")
        return

    try:
        s3_key, filename = _render_and_upload(job)
        _call_update(job_id, "SUCCESS", s3Key=s3_key, filename=filename)
    except Exception as exc:  # noqa: BLE001 — we want to catch everything
        logger.exception("PDF render failed")
        _call_update(job_id, "FAILED", error=str(exc)[:500])


def _render_and_upload(job: dict) -> tuple[str, str]:
    event = shared.get_event(job["eventId"])
    if not event:
        raise ValueError(f"Unknown eventId: {job['eventId']}")
    races = shared.get_races(job["eventId"], job.get("trackId"))
    if not races:
        raise ValueError("Cannot generate PDF for an event with no races")
    ranked = shared.build_ranked(event, races)
    brand = shared.default_brand()
    generated_at = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    t = job["type"]
    if t == "ORGANISER_SUMMARY":
        pdf_bytes = shared.render_organiser(event, ranked, races, brand, generated_at)
        key, filename = shared.s3_key(job["eventId"], "organiser-summary"), "organiser-summary.pdf"
    elif t == "PODIUM":
        pdf_bytes = shared.render_podium(event, ranked, brand, generated_at)
        key, filename = shared.s3_key(job["eventId"], "podium"), "podium.pdf"
    elif t == "RACER_CERTIFICATE":
        user_id = job.get("userId")
        if not user_id:
            raise ValueError("userId required for RACER_CERTIFICATE")
        racer = next((r for r in ranked if r["userId"] == user_id), None)
        if not racer:
            raise ValueError(f"Racer {user_id} has no results for event {job['eventId']}")
        pdf_bytes = shared.render_certificate(event, racer, brand, generated_at)
        key = shared.s3_key(job["eventId"], f"certificate-{racer['username']}")
        filename = f"certificate-{racer['username']}.pdf"
    elif t == "RACER_CERTIFICATES_BULK":
        pdf_bytes = shared.render_bulk_zip(event, ranked, brand, generated_at)
        key, filename = shared.s3_key(job["eventId"], "certificates"), "certificates.zip"
    else:
        raise ValueError(f"Unknown PDF type: {t}")

    shared.put_pdf_object(key, pdf_bytes, filename)
    return key, filename


def _call_update(job_id: str, status: str, **fields):
    variables = {"jobId": job_id, "status": status,
                 "s3Key": fields.get("s3Key"),
                 "filename": fields.get("filename"),
                 "error": fields.get("error")}
    appsync_iam.send_mutation(_UPDATE_MUTATION, variables)
