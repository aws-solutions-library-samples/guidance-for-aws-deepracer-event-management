#!/usr/bin/env python3
import hashlib
import json
import logging
import os
import random
import string
import subprocess
import sys

import boto3
from appsync_utils import send_mutation
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from combine_videos import VideoGroupingMode, combine_videos, organize_videos

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
        "Usage: Set the following environment variables: MATCHED_BAGS, CODEC, FRAME_LIMIT, DESCRIBE, RELATIVE_LABELS, BACKGROUND, SKIP_DURATION"
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


def create_dynamodb_entries(
    video_list: list[dict],
    fetch_job_id: str,
    car_name: str,
    event_id: str = None,
    event_name: str = None,
) -> None:

    logger.info("Creating DynamoDB entries for map: {}".format(video_list))

    for video in video_list:
        variables = {
            "sub": video["sub"],
            "username": video["username"],
            "assetId": hashlib.sha256(
                video["info"]["s3_key"].encode("utf-8")
            ).hexdigest(),
            "models": video["models"],  # Use models as a list of objects
            "fetchJobId": fetch_job_id,
            "carName": car_name,
            "eventId": event_id,  # Add event ID
            "eventName": event_name,  # Add event name
            "assetMetaData": {
                "key": video["info"]["s3_key"],
                "filename": video["info"]["s3_key"].split("/")[-1],
                "uploadedDateTime": scalar_types_utils.aws_datetime(),
            },
            "mediaMetaData": {
                "duration": video["info"]["duration"],
                "resolution": video["info"]["resolution"],
                "fps": video["info"]["fps"],
                "codec": video["info"]["codec"],
            },
            "type": "VIDEO",
        }

        logger.info(f"variables => {variables}")

        query = """
        mutation AddCarLogsAsset(
            $assetId: ID!
            $assetMetaData: AssetMetadataInput
            $mediaMetaData: MediaMetadataInput
            $models: [CarLogsModelInput]
            $eventId: String
            $eventName: String
            $type: CarLogsAssetTypeEnum!
            $sub: ID!
            $username: String!
            $fetchJobId: String
            $carName: String
        ) {
            addCarLogsAsset(
            assetId: $assetId
            assetMetaData: $assetMetaData
            mediaMetaData: $mediaMetaData
            models: $models
            eventId: $eventId
            eventName: $eventName
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
            mediaMetaData {
                duration
                resolution
                fps
                codec
            }
            models {
                modelId
                modelName
            }
            eventId
            eventName
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
        SKIP_DURATION (float): Skip video files with duration less than the specified value (default: 20.0).
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

    # Read in environment variables
    fetch_job_id = os.getenv("FETCH_JOB_ID", None)
    logs_bucket = os.getenv("LOGS_BUCKET")
    models_bucket = os.getenv("MODELS_BUCKET")
    codec = os.getenv("CODEC", "avc1")
    frame_limit = os.getenv("FRAME_LIMIT", None)
    describe = os.getenv("DESCRIBE", "False").lower() == "true"
    relative_labels = os.getenv("RELATIVE_LABELS", "False").lower() == "true"
    background = os.getenv("BACKGROUND", "True").lower() == "true"
    skip_duration = float(os.getenv("SKIP_DURATION", 20.0))
    job_data_bucket = os.getenv("JOB_DATA_BUCKET")
    job_data_key = os.getenv("JOB_DATA_KEY")

    try:
        job_data = json.loads(
            s3.get_object(Bucket=job_data_bucket, Key=job_data_key)["Body"].read()
        )
        logger.info(f"JOB_DATA: {job_data}")
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JOB_DATA: {e}")
        sys.exit(1)

    matched_bags = job_data["matched_bags"]
    if not matched_bags:
        logger.error("MATCHED_BAGS environment variable is required.")
        sys.exit(1)
    if "bags" not in matched_bags:
        raise ValueError("MATCHED_BAGS should contain an element 'bags'.")

    race_data = job_data.get("race_data")

    user_model_videos_map = []

    background = os.path.join(
        script_dir,
        "resources",
        "AWS-Deepracer_Background_Machine-Learning.928f7bc20a014c7c7823e819ce4c2a84af17597c.jpg",
    )

    image_assets = {
        "background": background,
        "logo": os.path.join(
            script_dir,
            "resources",
            "logo192.png",
        ),
    }

    fonts = {
        "regular": os.path.join(script_dir, "resources", "Amazon_Ember_Rg.ttf"),
        "bold": os.path.join(script_dir, "resources", "Amazon_Ember_Bd.ttf"),
        "heavy": os.path.join(script_dir, "resources", "Amazon_Ember_He.ttf"),
        "heavy-italic": os.path.join(script_dir, "resources", "Amazon_Ember_HeIt.ttf"),
        "light": os.path.join(script_dir, "resources", "Amazon_Ember_Lt.ttf"),
    }

    for bag in matched_bags["bags"]:

        logger.info(f"Processing bag: {bag}")

        # Store the user in our map
        if not any(
            user_model["sub"] == bag["sub"] for user_model in user_model_videos_map
        ):
            user_model_videos_map.append(
                {
                    "sub": bag["sub"],
                    "username": bag["username"],
                    "username_normalized": bag["username_normalized"],
                    "models": [],
                }
            )

        # Get the node of the current user
        current_user = next(
            user_model
            for user_model in user_model_videos_map
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
        cmd = (
            [
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
            + (["--relative_labels"] if relative_labels else [])
            + (["--background"] if image_assets["background"] else [])
            + (["--frame_limit", frame_limit] if frame_limit else [])
            + (["--describe"] if describe else [])
        )

        logger.info("Running command: %s", cmd)
        result = subprocess.run(cmd)
        exit_code = result.returncode
        if exit_code == 0 and os.path.isfile(video_file):
            logger.info(f"Finished processing {bag_path}")
            current_model["videos"].append(
                {
                    "file": video_file,
                    "timestamp": bag["timestamp"],
                }
            )
        else:
            logger.error(f"Error processing {bag_path}. Code {exit_code}")

    video_grouping_mode = VideoGroupingMode.USER_MODEL_DATE
    if race_data is not None and race_data.get("eventId") is not None:
        video_grouping_mode = VideoGroupingMode.USER_RACE

    logger.info(
        f"\nFinished processing all bag files. Combining videos using {video_grouping_mode.name}.\n"
    )

    video_files_list = organize_videos(
        user_model_videos_map,
        video_grouping_mode=video_grouping_mode,
        car_name=matched_bags["car_name"],
    )
    logger.info(
        "Video files grouped by prefix and date: %s",
        json.dumps(video_files_list, indent=2),
    )

    for video in video_files_list:
        final_output_dir = os.path.join(output_dir, video["sub"], "final")
        os.makedirs(final_output_dir, exist_ok=True)
        output_file = os.path.join(final_output_dir, video["output_file"])

        video_info = combine_videos(
            video["source_videos"],
            output_file,
            image_assets,
            fonts,
            codec=codec,
            skip_duration=skip_duration,
            update_frequency=1,
            metadata={
                "username": video["username"],
                "race_data": race_data,
                "car_name": matched_bags["car_name"],
                "event_name": matched_bags.get("event_name", None),
                "models": video["models"],
            },
        )
        logger.info(f"Created video {output_file}.", video_info)

        s3_key = os.path.relpath(output_file, final_output_dir)
        s3_key = "/".join(["private", video["sub"], "videos", s3_key])
        logger.info(f"Uploading {output_file} to s3://{logs_bucket}/{s3_key}")
        s3.upload_file(output_file, logs_bucket, s3_key)
        video_info["s3_key"] = s3_key

        video["info"] = video_info

    create_dynamodb_entries(
        video_files_list,
        fetch_job_id,
        matched_bags["car_name"],
        matched_bags.get("event_id", None),
        matched_bags.get("event_name", None),
    )

    logger.info("\nFinished processing videos...\n")


if __name__ == "__main__":
    main()
