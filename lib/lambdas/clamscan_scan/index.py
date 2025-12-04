
import sys
import subprocess
import json
import os
import boto3
from urllib.parse import unquote_plus
from aws_lambda_powertools import Logger, Tracer


logger = Logger()

session = boto3.session.Session()
client_s3 = boto3.client("s3")

MAX_BYTES = 4000000000
INPROGRESS = "IN PROGRESS"
CLEAN = "CLEAN"
INFECTED = "INFECTED"
ERROR = "ERROR"
SKIP = "N/A"

LIBRARY_BUCKET = os.environ["LIBRARY_BUCKET"]
DEFINITIONS_PATH = os.environ["CONTAINER_DEFINITIONS_PATH"]


class ClamAVException(Exception):
    """Raise when ClamAV returns an unexpected exit code"""
    def __init__(self, message):
        self.message = message

    def __str__(self):
        return str(self.message)


def init():
    logger.info("ClamAV scanning disabled - mock initialization")
    return True


def create_dir(path):
    """Creates a directory at the specified location
    if it does not already exists"""
    if not os.path.exists(path):
        try:
            os.makedirs(path, exist_ok=True)
        except OSError as e:
            report_failure(path, str(e))

@logger.inject_lambda_context
def handler(event, context):
    logger.info(json.dumps(event))

    file_download_path = "/tmp/files"
    bucket_info = event["detail"]

    input_bucket = bucket_info["bucket"]["name"]
    input_key = unquote_plus(bucket_info["object"]["key"])
    summary = ""

    if not input_key.endswith("/"):
        create_dir(file_download_path)

        filename = os.path.basename(input_key)

        final_path = f"{file_download_path}/{filename}"
        client_s3.download_file(input_bucket,
                                input_key,
                                final_path)

        summary = scan(input_key, file_download_path)
        summary['input_bucket'] = input_bucket

        os.remove(final_path)

    else:
        summary = {
            "source": "serverless-clamscan",
            "input_bucket": input_bucket,
            "input_key": input_key,
            "detail-type": SKIP,
            "status": SKIP,
            "message": "Event was for a non-file object",
        }

    logger.info(summary)

    return summary


def scan(input_key, download_path):
    logger.info(f"Mock scanning file: {input_key} - always returning CLEAN")

    return {
        "source": "serverless-clamscan",
        "detail-type": CLEAN,
        "input_key": input_key,
        "status": CLEAN,
        "message": "Mock scan: File marked as clean (scanning disabled)",
    }


def report_failure(input_key, message):
    exception_json = {
        "source": "serverless-clamscan",
        "input_key": input_key,
        "status": ERROR,
        "message": message,
    }
    raise Exception(json.dumps(exception_json))


init()
