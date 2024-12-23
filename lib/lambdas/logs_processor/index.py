import hashlib
import boto3
import tarfile
import os
import io

import appsync_helpers
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
s3_client = boto3.client("s3")


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(json.dumps(event))

    # Get the required data from the event json
    for record in event["Records"]:
        if record["eventName"] == "ObjectCreated:CompleteMultipartUpload":
            bucket = record["s3"]["bucket"]["name"]
            key = record["s3"]["object"]["key"]

            logger.info(f"Processing file {key} from bucket {bucket}")

            try:
                # Create a temporary directory for extraction
                tmp_dir = "/tmp/extracted"
                if not os.path.exists(tmp_dir):
                    os.makedirs(tmp_dir)

                # Download the tar.gz file into memory
                tar_obj = s3_client.get_object(Bucket=bucket, Key=key)
                buffer = io.BytesIO(tar_obj["Body"].read())

                # Extract the tar.gz file
                with tarfile.open(fileobj=buffer, mode="r:gz") as tar:
                    # Check for path traversal attempts
                    for member in tar.getmembers():
                        if member.name.startswith("/") or ".." in member.name:
                            logger.error(
                                f"Potentially malicious path in tar: {member.name}"
                            )
                            raise ValueError("Potentially malicious tar file detected")
                        # Additional security check for absolute paths
                        member_path = os.path.join(tmp_dir, member.name)
                        if not os.path.abspath(member_path).startswith(
                            os.path.abspath(tmp_dir)
                        ):
                            logger.error(
                                f"Path traversal attempt detected: {member.name}"
                            )
                            raise ValueError("Path traversal attempt detected")

                    # Safe to extract
                    tar.extractall(tmp_dir)

                logger.info(f"Successfully extracted files to {tmp_dir}")

                # Process the extracted files here
                extracted_files = os.listdir(tmp_dir)
                logger.info(f"Extracted files: {extracted_files}")

                # Clean up
                for root, dirs, files in os.walk(tmp_dir, topdown=False):
                    for name in files:
                        os.remove(os.path.join(root, name))
                    for name in dirs:
                        os.rmdir(os.path.join(root, name))
                os.rmdir(tmp_dir)

            except tarfile.ReadError as e:
                logger.error(f"Error reading tar file: {str(e)}")
                raise
            except Exception as e:
                logger.error(f"Error processing tar.gz file: {str(e)}")
                raise

    return {"statusCode": 200, "body": json.dumps("Processing completed successfully")}
