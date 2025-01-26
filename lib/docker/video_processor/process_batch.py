#!/usr/bin/env python3
import hashlib
import json
import os
import sys
import subprocess
import boto3
import logging

from appsync_utils import send_mutation
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils

TMP_DIR = "/tmp"

log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("process_batch.py")
s3 = boto3.client("s3")


def usage():
    logger.info(
        "Usage: Set the following environment variables: MATCHED_BAGS, CODEC, FRAME_LIMIT, DESCRIBE, RELATIVE_LABELS, BACKGROUND, PATTERN, SKIP_DURATION, GROUP_SLICE"
    )
    sys.exit(1)


def download_model_from_s3(bag, s3_bucket, models_dir) -> str:
    model = bag["model"]
    sub = bag["sub"]
    model_dir = os.path.join(models_dir, sub, model["id"])
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, model["filename"])
    if not os.path.isfile(model_path):
        s3_key = model["key"]
        logger.info(
            f"Downloading model {model['name']} from S3 bucket s3://{s3_bucket}/{s3_key} to {model_path}"
        )
        s3.download_file(s3_bucket, s3_key, model_path)
    return model_path


def download_bag_from_s3(bag, s3_bucket, input_dir) -> str:
    bag_key = bag["bag_key"]
    sub = bag["sub"]
    bag_dir = os.path.join(input_dir, sub, os.path.basename(bag_key))
    os.makedirs(bag_dir, exist_ok=True)

    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=s3_bucket, Prefix=bag_key):
        for obj in page.get("Contents", []):
            file_key = obj["Key"]
            file_key_parts = file_key.split("/")[3:]
            stripped_file_key = "/".join(file_key_parts)
            file_path = os.path.join(input_dir, sub, stripped_file_key)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            if not os.path.isfile(file_path):
                logger.info(
                    f"Downloading {file_key} from S3 bucket {s3_bucket} to {file_path}"
                )
                s3.download_file(s3_bucket, file_key, file_path)

    return bag_dir


def upload_files_to_s3(folder, s3_bucket, s3_prefix) -> None:

    uploaded_files = []

    for root, _, files in os.walk(folder):
        for file in files:
            file_path = os.path.join(root, file)
            s3_key = os.path.relpath(file_path, folder)
            s3_key = "/".join([s3_prefix, s3_key])
            uploaded_files.append(s3_key)
            logger.info(f"Uploading {file_path} to s3://{s3_bucket}/{s3_key}")
            s3.upload_file(file_path, s3_bucket, s3_key)

    return uploaded_files


def create_dynamodb_entries(
    user_model_map: list[dict], fetch_job_id: str, car_name: str
) -> None:

    logger.info("Creating DynamoDB entries for map: {}".format(user_model_map))

    for user in user_model_map:
        for model in user["models"]:
            for video in model["videos"]:
                variables = {
                    "sub": user["sub"],
                    "username": user["username"],
                    "assetId": hashlib.sha256(
                        video["file"].encode("utf-8")
                    ).hexdigest(),
                    "modelId": model["modelId"],
                    "modelname": model["modelname"],
                    "fetchJobId": fetch_job_id,
                    "carName": car_name,
                    "assetMetaData": {
                        "key": video["file"],
                        "filename": video["file"].split("/")[-1],
                        "uploadedDateTime": scalar_types_utils.aws_datetime(),
                    },
                    "type": "VIDEO",
                }

                logger.info(f"variables => {variables}")

                query = """
                mutation AddCarLogsAsset(
                    $assetMetaData: AssetMetadataInput
                    $assetId: ID!
                    $modelname: String
                    $modelId: String!
                    $type: CarLogsAssetTypeEnum!
                    $sub: ID!
                    $username: String!
                    $fetchJobId: String
                    $carName: String
                ) {
                    addCarLogsAsset(
                    assetId: $assetId
                    assetMetaData: $assetMetaData
                    modelId: $modelId
                    modelname:  $modelname
                    type: $type
                    sub: $sub
                    username: $username
                    fetchJobId: $fetchJobId
                    carName: $carName
                    ) {
                    assetId
                    assetMetaData {
                        filename
                        key
                        uploadedDateTime
                    }
                    modelId
                    modelname
                    fetchJobId
                    carName
                    type
                    sub
                    username
                    }
                }
                """

                send_mutation(query, variables)


def main():
    """
    Main function to process bag files and generate videos.
    This function reads environment variables to get the input directory, output directory,
    models directory, codec, frame limit, and other options. It then processes each bag file
    in the input directory, runs analysis using the specified model, and generates videos.
    Finally, it combines all the generated videos into a single output.
    Environment variables:
        MATCHED_BAGS (dict): A dictionary containing the matched bags.
        CODEC (str): The codec for the video writer (default: "avc1").
        FRAME_LIMIT (int): Max number of frames to process (default: None).
        DESCRIBE (bool): Describe the actions (default: False).
        RELATIVE_LABELS (bool): Make labels relative, not fixed to value in action space (default: False).
        BACKGROUND (bool): Add a background to the video (default: True).
        PATTERN (str): Pattern to filter bag files (default: "*").
        SKIP_DURATION (float): Skip video files with duration less than the specified value (default: 20.0).
        GROUP_SLICE (str): Slice to allow videos to be grouped (default: ":-2").
    Exits with status 1 if any of the required directories do not exist.
    """

    # Log environment variables
    logger.info("Starting processing of bag files...")
    logger.info("Environment variables: %s", os.environ.items())

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(TMP_DIR, "input")
    output_dir = os.path.join(TMP_DIR, "output")
    models_dir = os.path.join(TMP_DIR, "models")

    # Create directories if they don't exist
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    matched_bags = os.getenv("MATCHED_BAGS")
    if not matched_bags:
        logger.error("MATCHED_BAGS environment variable is required.")
        sys.exit(1)

    try:
        matched_bags = json.loads(matched_bags) if matched_bags else {}
        if not isinstance(matched_bags, dict):
            raise ValueError("MATCHED_BAGS should be a JSON object.")
        if "bags" not in matched_bags:
            raise ValueError("MATCHED_BAGS should contain an element 'bags'.")
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding MATCHED_BAGS: {e}")
        sys.exit(1)

    # Read in optional environment variables
    fetch_job_id = os.getenv("FETCH_JOB_ID", None)
    logs_bucket = os.getenv("LOGS_BUCKET")
    models_bucket = os.getenv("MODELS_BUCKET")
    codec = os.getenv("CODEC", "avc1")
    frame_limit = os.getenv("FRAME_LIMIT", None)
    describe = os.getenv("DESCRIBE", "False").lower() == "true"
    relative_labels = os.getenv("RELATIVE_LABELS", "False").lower() == "true"
    background = os.getenv("BACKGROUND", "True").lower() == "true"
    pattern = os.getenv("PATTERN", "*")
    skip_duration = float(os.getenv("SKIP_DURATION", 20.0))
    group_slice = os.getenv("GROUP_SLICE", ":-2")

    user_model_map = []

    for bag in matched_bags["bags"]:

        logger.info(f"Processing bag: {bag}")

        # Store the user in our map
        if not any(user_model["sub"] == bag["sub"] for user_model in user_model_map):
            user_model_map.append(
                {"sub": bag["sub"], "username": bag["username"], "models": []}
            )

        # Get the node of the current user
        current_user = next(
            user_model
            for user_model in user_model_map
            if user_model["sub"] == bag["sub"]
        )

        # Check if the current model is already in the user's models list
        if not any(
            model["modelId"] == bag["model"]["id"] for model in current_user["models"]
        ):
            current_user["models"].append(
                {
                    "modelId": bag["model"]["id"],
                    "modelname": bag["model"]["name"],
                    "videos": [],
                }
            )

        # Get the node of the current model
        current_model = next(
            model
            for model in current_user["models"]
            if model["modelId"] == bag["model"]["id"]
        )

        # Download the model and bag files from S3
        bag["model"]["local_path"] = download_model_from_s3(
            bag, models_bucket, models_dir
        )
        bag["bag_local_path"] = download_bag_from_s3(bag, logs_bucket, input_dir)

        bag_path = bag["bag_local_path"]
        model_path = bag["model"]["local_path"]
        video_file = os.path.join(
            output_dir,
            bag["sub"],
            bag["model"]["id"],
            "intermediate",
            os.path.basename(bag_path) + ".mp4",
        )

        os.makedirs(os.path.dirname(video_file), exist_ok=True)

        logger.info(f"Running analysis for {bag_path}")
        cmd = [
            "python3",
            os.path.join(script_dir, "bag_analysis.py"),
            "--bag_path",
            bag_path,
            "--model",
            model_path,
            "--codec",
            codec,
            "--update_frequency",
            "5",
            "--output_file",
            video_file,
        ]
        if relative_labels:
            cmd.extend(["--relative_labels"])
        if background:
            cmd.extend(["--background"])
        if frame_limit:
            cmd.extend(["--frame_limit", frame_limit])
        if describe:
            cmd.append("--describe")

        logger.info("Running command: %s", cmd)
        result = subprocess.run(cmd)
        exit_code = result.returncode
        if exit_code == 0:
            logger.info(f"Finished processing {bag_path}")
        else:
            logger.error(f"Error processing {bag_path}. Exiting with code {exit_code}")

            sys.exit(exit_code)

    logger.info("\nFinished processing all bag files. Combining videos...\n")

    for user in user_model_map:
        for model in user["models"]:

            final_output_dir = os.path.join(
                output_dir, user["sub"], model["modelId"], "final"
            )
            os.makedirs(final_output_dir, exist_ok=True)

            # After processing all bag files, combine the videos
            combine_videos_script = os.path.join(script_dir, "combine_videos.py")
            cmd = [
                "python3",
                combine_videos_script,
                "--input_dir",
                os.path.join(output_dir, user["sub"], model["modelId"], "intermediate"),
                "--output_dir",
                final_output_dir,
                "--codec",
                codec,
                "--pattern",
                pattern,
                "--skip_duration",
                str(skip_duration),
                "--group_slice",
                group_slice,
                "--update_frequency",
                "1",
                "--car_name",
                matched_bags["car_name"],
                "--delimiter",
                "_",
                "--unique",
            ]
            logger.info("Running command: %s", cmd)
            result = subprocess.run(cmd)
            exit_code = result.returncode
            if exit_code == 0:
                logger.info(f"Finished combining videos for {user}")

                uploaded_files = upload_files_to_s3(
                    final_output_dir,
                    logs_bucket,
                    "/".join(["private", user["sub"], "videos"]),
                )

                # Add the video file to the current model
                for s3_key in uploaded_files:
                    model["videos"].append({"file": s3_key})

            else:
                logger.error(
                    f"Error processing {bag_path}. Exiting with code {exit_code}"
                )

                # Log the contents of the TMP_DIR
                logger.info("Listing contents of TMP_DIR:")
                subprocess.run(["ls", "-lR", TMP_DIR])

                sys.exit(exit_code)

    create_dynamodb_entries(user_model_map, fetch_job_id, matched_bags["car_name"])

    logger.info("\nFinished processing videos...\n")


if __name__ == "__main__":
    main()
