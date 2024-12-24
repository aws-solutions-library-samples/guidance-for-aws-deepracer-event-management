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

EXTRACTED_DIR = "/tmp/extracted"


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(json.dumps(event))

    # Create a temporary directory for extraction
    tmp_dir = EXTRACTED_DIR
    if not os.path.exists(tmp_dir):
        os.makedirs(tmp_dir)

    # Get the required data from the event json
    for record in event["Records"]:
        if record["eventName"] == "ObjectCreated:CompleteMultipartUpload":
            bucket = record["s3"]["bucket"]["name"]
            key = record["s3"]["object"]["key"]
            logger.info(f"Processing file {key} from bucket {bucket}")

            # Extract filename from key and strip .tar.gz
            batch_name = key.split("/")[-1].replace(".tar.gz", "")
            car_name = batch_name.split("_")[0]
            timestamp = batch_name.split("_")[1]
            logger.info(
                f"Batch name: {batch_name}, car name: {car_name}, timestamp: {timestamp}"
            )

            # Get the car ID from AppSync
            car_id, online = get_car_id(car_name)
            logger.info(f"Found car {car_name} as {car_id}, online: {online}")

            try:

                extracted_dirs = download_and_extract_tar(bucket, key, tmp_dir)

                for bag_dir in extracted_dirs:
                    pass

            except Exception as e:
                logger.error(f"Error processing tar.gz file: {str(e)}")
                raise

    return {"statusCode": 200, "body": json.dumps("Processing completed successfully")}


def get_car_id(car_name: str) -> tuple[str, bool]:
    """
    Query AppSync to check if a car exists and get its ID
    Args:
        car_name: Name of the car to look up
    Returns:
        Tuple containing the car ID and a boolean indicating if the car is online
    Raises:
        Exception if car not found or error occurs
    """

    query = """
    query carsOnline($online: Boolean!) {
        carsOnline(online: $online) {
            InstanceId
            ComputerName
            LastPingDateTime
        }
    }
    """

    try:
        response = appsync_helpers.run_query(query, {"online": True})

        if response.get("data", {}).get("carsOnline"):
            for car in response["data"]["carsOnline"]:
                if car.get("ComputerName") == car_name:
                    return car["InstanceId"], True

        response = appsync_helpers.run_query(query, {"online": False})

        if response.get("data", {}).get("carsOnline"):
            for car in response["data"]["carsOnline"]:
                if car.get("ComputerName") == car_name:
                    return car["InstanceId"], False
            raise Exception(f"Car with name {car_name} not found")
        else:
            raise Exception(f"Car with name {car_name} not found")

    except Exception as e:
        logger.error(f"Error querying car ID: {str(e)}")
        raise


def download_and_extract_tar(bucket: str, key: str, tmp_dir: str) -> list[str]:

    try:

        # Download the tar.gz file into memory
        tar_obj = s3_client.get_object(Bucket=bucket, Key=key)
        buffer = io.BytesIO(tar_obj["Body"].read())

        # Extract the tar.gz file
        with tarfile.open(fileobj=buffer, mode="r:gz") as tar:
            # Check for path traversal attempts
            for member in tar.getmembers():
                if member.name.startswith("/") or ".." in member.name:
                    logger.error(f"Potentially malicious path in tar: {member.name}")
                    raise ValueError("Potentially malicious tar file detected")
                # Additional security check for absolute paths
                member_path = os.path.join(tmp_dir, member.name)
                if not os.path.abspath(member_path).startswith(
                    os.path.abspath(tmp_dir)
                ):
                    logger.error(f"Path traversal attempt detected: {member.name}")
                    raise ValueError("Path traversal attempt detected")

            # Safe to extract
            tar.extractall(tmp_dir)

            # Process the extracted files here
            extracted_files = os.listdir(tmp_dir)
            logger.debug(f"Extracted files: {extracted_files}")

            return extracted_files

        logger.info(f"Successfully extracted files to {tmp_dir}")

    except tarfile.ReadError as e:
        logger.error(f"Error reading tar file: {str(e)}")
        raise

    except Exception as e:
        logger.error(f"Error extracting tar file: {str(e)}")
        raise


def clean_directory(tmp_dir: str) -> None:
    """
    Clean up the temporary directory.
    """
    for root, dirs, files in os.walk(tmp_dir, topdown=False):
        for name in files:
            os.remove(os.path.join(root, name))
        for name in dirs:
            os.rmdir(os.path.join(root, name))
