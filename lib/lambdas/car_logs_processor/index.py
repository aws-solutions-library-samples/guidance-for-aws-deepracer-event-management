import hashlib
import io
import os
import re
import tarfile

import appsync_helpers
import boto3
import simplejson as json
import yaml
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes.appsync import scalar_types_utils
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
s3_client = boto3.client("s3")

EXTRACTED_DIR = "/tmp/extracted"


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.info(json.dumps(event))

    # Create a temporary directory for extraction
    if not os.path.exists(EXTRACTED_DIR):
        os.makedirs(EXTRACTED_DIR)

    # The output bucket for the processed files
    input_bucket = os.environ["BAGS_UPLOAD_BUCKET"]
    output_bucket = os.environ["OUTPUT_BUCKET"]

    # Get the required data from the event json
    # Theoretically we can receive more than one file

    if "Records" in event:
        for record in event["Records"]:
            if record["eventName"] in [
                "ObjectCreated:CompleteMultipartUpload",
                "ObjectCreated:Put",
                "ObjectCreated:Post",
            ]:
                bucket = record["s3"]["bucket"]["name"]
                key = record["s3"]["object"]["key"]

                matched_bags, batch_job_id = process_bag_files(
                    bucket, key, output_bucket, "Manual"
                )
    elif "data" in event:
        race_data = None
        if "raceData" in event["data"] and event["data"]["raceData"] is not None:
            race_data = json.loads(event["data"]["raceData"])

        matched_bags, batch_job_id = process_bag_files(
            input_bucket,
            event["data"]["ssm"]["uploadKey"],
            output_bucket,
            event["data"]["jobId"],
            race_data,
            event["data"].get("eventId", None),
            event["data"].get("eventName", None),
        )
    else:
        raise ValueError("Invalid event format")

    return {
        "statusCode": 200,
        "body": {"matched_bags": matched_bags, "batchJobId": batch_job_id},
    }


def process_bag_files(
    input_bucket: str,
    key: str,
    output_bucket: str,
    fetch_job_id: str,
    race_data: dict = None,
    eventId: str = None,
    eventName: str = None,
) -> tuple[dict, str]:

    logger.info(f"Processing file {key} from bucket {input_bucket}")

    # Extract filename from key and strip .tar.gz
    batch_name = key.split("/")[-1].replace(".tar.gz", "")
    car_name = batch_name.split("_")[0]
    timestamp = batch_name.split("_")[1]
    logger.info(
        f"Batch name: {batch_name}, car name: {car_name}, timestamp: {timestamp}"
    )

    matched_bags = {"bags": []}
    matched_bags["car_name"] = car_name
    if eventId:
        matched_bags["event_id"] = eventId
        matched_bags["event_name"] = eventName

    # Get the car ID from AppSync
    car_id, online = get_car_id(car_name)
    logger.info(f"Found car {car_name} as {car_id}, online: {online}")

    # If provided with a race user, find the user in the list
    if race_data:
        filtered_users = query_users(race_data["username"])
        race_user = [
            user for user in filtered_users if user["username"] == race_data["username"]
        ][0]
    else:
        # Get the list of users from AppSync
        all_users = query_users()
        logger.info(f"Input user list: {all_users}")

    # Iterate over the tar.gz files and process them
    try:
        extracted_dirs = download_and_extract_tar(input_bucket, key, EXTRACTED_DIR)

        for bag_dir in extracted_dirs:

            if race_data:
                user_model_info = confirm_user_and_model(race_user, bag_dir)
            else:
                user_model_info = find_user_and_model(all_users.copy(), bag_dir)

            if user_model_info:
                logger.info(
                    "Found user and model match: {} {}".format(
                        user_model_info["username"],
                        user_model_info["model"]["name"],
                    )
                )

                # Upload the bag into the user's log and video directory
                bag_key = f"private/{user_model_info['sub']}/logs/{bag_dir}"

                bag_type = "UNKNOWN"
                with open(
                    os.path.join(EXTRACTED_DIR, bag_dir, "metadata.yaml"), "r"
                ) as yaml_file:
                    metadata = yaml.safe_load(yaml_file)
                    bag_type_raw = metadata.get("rosbag2_bagfile_information", {}).get(
                        "storage_identifier", "unknown"
                    )
                    if bag_type_raw == "sqlite3":
                        bag_type = "BAG_SQLITE"
                    elif bag_type_raw == "mcap":
                        bag_type = "BAG_MCAP"

                for root, _, files in os.walk(os.path.join(EXTRACTED_DIR, bag_dir)):
                    for file in files:
                        file_path = os.path.join(root, file)
                        s3_key = os.path.join(
                            bag_key,
                            os.path.relpath(
                                file_path, os.path.join(EXTRACTED_DIR, bag_dir)
                            ),
                        )
                        s3_client.upload_file(file_path, output_bucket, s3_key)
                        logger.debug(
                            f"Uploaded {file_path} to s3://{output_bucket}/{s3_key}"
                        )
                user_model_info["bag_key"] = bag_key
                user_model_info["bag_type"] = bag_type
                matched_bags["bags"].append(user_model_info)
            else:
                logger.warning(f"Could not find user/model match for {bag_dir}")

        logger.info(f"Matched bags: {matched_bags}")

    except Exception as e:
        logger.error(f"Error processing tar.gz file: {str(e)}")
        raise

    finally:
        clean_directory(EXTRACTED_DIR)

    # Create a batch job for the matched bags
    job_queue = os.environ["JOB_QUEUE"]
    job_definition = os.environ["JOB_DEFINITION"]
    job_config_key = f"job-configs/{fetch_job_id}.json"
    job_data = {
        "matched_bags": matched_bags,
        "car_id": car_id,
    }
    if race_data:
        job_data["race_data"] = race_data

    s3_client.put_object(
        Bucket=output_bucket, Key=job_config_key, Body=json.dumps(job_data)
    )

    batch_client = boto3.client("batch")
    try:

        job_variables = {
            "environment": [
                {"name": "FETCH_JOB_ID", "value": fetch_job_id},
                {"name": "JOB_DATA_BUCKET", "value": output_bucket},
                {"name": "JOB_DATA_KEY", "value": job_config_key},
            ]
        }

        response = batch_client.submit_job(
            jobName=f"process-logs-{timestamp}",
            jobQueue=job_queue,
            jobDefinition=job_definition,
            containerOverrides=job_variables,
        )
        logger.info(f"Batch job submitted successfully: {response['jobId']}")
    except Exception as e:
        logger.error(f"Error submitting batch job: {str(e)}")
        raise

    create_dynamodb_entries(matched_bags, fetch_job_id)

    return matched_bags, response["jobId"]


def create_dynamodb_entries(matched_bags: dict, fetch_job_id: str) -> None:
    for bag in matched_bags["bags"]:
        # Create a models list with the current model
        models_list = [
            {"modelId": bag["model"]["id"], "modelName": bag["model"]["name"]}
        ]

        variables = {
            "sub": bag["sub"],
            "username": bag["username"],
            "assetId": hashlib.sha256(bag["bag_key"].encode("utf-8")).hexdigest(),
            "models": models_list,
            "eventId": matched_bags.get("event_id", None),
            "eventName": matched_bags.get("event_name", None),
            "assetMetaData": {
                "key": bag["bag_key"],
                "filename": bag["bag_key"].split("/")[-1],
                "uploadedDateTime": scalar_types_utils.aws_datetime(),
            },
            "fetchJobId": fetch_job_id,
            "carName": matched_bags["car_name"],
            "type": bag["bag_type"],
        }

        logger.info(f"variables => {variables}")

        query = """
        mutation AddCarLogsAsset(
            $assetMetaData: AssetMetadataInput
            $assetId: ID!
            $models: [CarLogsModelInput]
            $eventId: String
            $eventName: String
            $fetchJobId: String
            $type: CarLogsAssetTypeEnum!
            $sub: ID!
            $username: String!
            $carName: String
        ) {
            addCarLogsAsset(
            assetId: $assetId
            assetMetaData: $assetMetaData
            models: $models
            eventId: $eventId
            eventName: $eventName
            fetchJobId: $fetchJobId
            carName: $carName
            type: $type
            sub: $sub
            username: $username
            ) {
            assetId
            assetMetaData {
                filename
                key
                uploadedDateTime
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

        appsync_helpers.send_mutation(query, variables)


def confirm_user_and_model(user: dict, bag_dir: str) -> dict:
    """
    Confirm the user and model from the bag directory name
    Expected format: <username>-<modelname>-YYYYMMDD-HHMMSS
    Where username and modelname can themselves contain hyphens.
    If username contains underscore (_) it is stripped during comparison!
    Args:
        user: Username to confirm
        bag_dir: Name of the bag directory
    Returns:
        Dictionary containing user and model information, or None if not found
    """
    # Use regex to extract the date and time part
    pattern = r"^(.*)-(\d{8}-\d{6})$"
    match = re.match(pattern, bag_dir)

    if not match:
        logger.warning(
            f"Bag directory {bag_dir} has invalid format (doesn't match expected pattern)"
        )
        return None

    # Extract the components
    prefix = match.group(1)  # This contains username-modelname
    bag_timestamp = match.group(2)  # YYYYMMDD-HHMMSS

    # Normalize username (remove non-allowed characters)
    normalized_username = re.sub("[^0-9a-zA-Z-]+", "", user["username"])

    # Check if the bag directory starts with the normalized username
    if not prefix.startswith(f"{normalized_username}-"):
        logger.warning(
            f"Normalized username: '{normalized_username}' does not match as prefix in '{prefix}'"
        )
        return None

    # Extract model name - it's everything after username- and before the timestamp
    if len(normalized_username) + 1 >= len(prefix):
        logger.warning(
            f"Invalid prefix structure in {bag_dir}, can't extract model name"
        )
        return None

    model_name = prefix[len(normalized_username) + 1 :]

    # Create the matched model dictionary
    matched_model = {
        "model": {"name": model_name},
        "username": user["username"],
        "username_normalized": normalized_username,
        "sub": user["sub"],
        "timestamp": bag_timestamp,
    }

    # Check if the model exists
    model_info = query_model(matched_model["sub"], model_name)
    if not model_info:
        logger.warning(f"Model '{model_name}' not found for user '{user}'")
        return None

    matched_model["model"] = model_info
    return matched_model


def find_user_and_model(all_users: list[dict], bag_dir: str) -> dict:
    """
    Find the user and model from the bag directory name
    Expected format: <username>-<modelname>-YYYYMMDD-HHMMSS
    Where username and modelname can themselves contain hyphens.
    If username contains underscore (_) it is stripped during comparison!

    Args:
        all_users: List of dictionaries containing user information
        bag_dir: Name of the bag directory
    Returns:
        Dictionary containing user and model information, or None if not found
    """

    # Use regex to extract the date and time part
    pattern = r"^(.*)-(\d{8}-\d{6})$"
    match = re.match(pattern, bag_dir)

    if not match:
        logger.warning(
            f"Bag directory {bag_dir} has invalid format (doesn't match expected pattern)"
        )
        return None

    # Extract the components
    prefix = match.group(1)  # This contains username-modelname
    bag_timestamp = match.group(2)  # YYYYMMDD-HHMMSS

    # Validate bag directory format
    prefix_split = prefix.split("-")

    # Search for unique username match
    candidate_user_model = []

    # Try every possible segment division, leaving at least one segment for the model name
    for segment in range(1, len(prefix_split)):
        user_prefix = "-".join(prefix_split[:segment])
        logger.info(f"Checking for user prefix: {user_prefix}")

        matching_users = []
        remaining_users = []

        # Pre-normalize usernames and create a more efficient lookup structure
        for user in all_users:
            username = user["username"]
            normalized_username = re.sub("[^0-9a-zA-Z-]+", "", username)

            # Store both original user and normalized username
            if normalized_username == user_prefix:
                # We have a match - the username exactly matches our prefix
                model_name = "-".join(prefix_split[segment:])
                matching_users.append((user, normalized_username, {"name": model_name}))
            elif normalized_username.startswith(user_prefix):
                # Keep users that might match a longer prefix
                remaining_users.append(user)

        # Replace all_users with the filtered list for next iteration
        all_users = remaining_users

        if matching_users:
            candidate_user_model.extend(matching_users)
            logger.info(
                {
                    "message": "Found candidate matches",
                    "bag_dir": bag_dir,
                    "matches": [u[0]["username"] for u in matching_users],
                }
            )
            break

    if not candidate_user_model:
        logger.warning(f"Could not find user / model match for {bag_dir}")
        return None

    matched_model = {}

    # Iterate over the proposed user / model combinations and check if the model exists
    valid_candidates = []
    for user, normalized_username, model_name in candidate_user_model:
        # Check if the model exists
        model_info = query_model(user["sub"], model_name["name"])
        if model_info:
            valid_candidates.append((user, model_name))
            matched_model["model"] = model_info
            matched_model["username"] = user["username"]
            matched_model["username_normalized"] = normalized_username
            matched_model["sub"] = user["sub"]
            matched_model["timestamp"] = bag_timestamp

    # Update candidate_user_model to only include valid candidates
    candidate_user_model = valid_candidates

    # No candidate found - can't proceed
    if not candidate_user_model:
        logger.warning(f"Could not find valid model match for {bag_dir}")
        return None

    # Multiple matches not possible!
    elif len(candidate_user_model) > 1:
        logger.warning(
            f"Multiple user / model matches found for {bag_dir}: {candidate_user_model}"
        )
        return None

    else:
        return matched_model


def query_model(sub: str, model_name: str) -> dict:
    """
    Query AppSync to check if a model exists

    Args:
        sub: Unique identifier of the user
        model_name: Name of the model to look up
    Returns:
        dict containing the model details, None if model was not found
    Raises:
        Exception if error occurs
    """

    query = """
    query getAllModels($user_sub: String!) {
        getAllModels(user_sub: $user_sub) {
            models {
                modelId
                modelname
                fileMetaData {
                    key
                    filename
                }
            }      
        }
    }
    """

    try:
        model_data = {}

        response = appsync_helpers.run_query(query, {"user_sub": sub})

        if response.get("data", {}).get("getAllModels"):
            for model in response["data"]["getAllModels"]["models"]:
                if model["modelname"] == model_name:
                    model_data["id"] = model["modelId"]
                    model_data["name"] = model["modelname"]
                    model_data["key"] = model["fileMetaData"]["key"]
                    model_data["filename"] = model["fileMetaData"]["filename"]
                    return model_data
            return None
        else:
            return None

    except Exception as e:
        logger.error(f"Error querying for users: {str(e)}")
        raise


def query_users(username_prefix: str = None) -> list[dict]:
    """
    Query AppSync to check if a user exists and get their ID
    Args:
        username_prefix: Optional username prefix to filter users on the server side
    Returns:
        List of user IDs and their unique identifiers
    Raises:
        Exception if no users found or error occurs
    """

    query = """
    query listUsers($username_prefix: String) {
        listUsers(username_prefix: $username_prefix) {
            sub
            Username
        }    
    }
    """

    # If username_prefix is not provided, pass None or don't include it in variables
    variables = {}
    if username_prefix:
        variables["username_prefix"] = username_prefix

    try:
        users = []

        response = appsync_helpers.run_query(query, variables)

        if response.get("data", {}).get("listUsers"):
            for user in response["data"]["listUsers"]:
                users.append({"username": user["Username"], "sub": user["sub"]})

            log_message = f"Found {len(users)} users"
            if username_prefix:
                log_message += f" matching prefix '{username_prefix}'"
            logger.info(log_message)

            return users
        else:
            raise Exception(
                f"No users found{' with prefix ' + username_prefix if username_prefix else ''}!"
            )

    except Exception as e:
        logger.error(f"Error querying for users: {str(e)}")
        raise


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
    query listCars($online: Boolean!) {
        listCars(online: $online) {
            InstanceId
            ComputerName
            LastPingDateTime
        }
    }
    """

    try:
        response = appsync_helpers.run_query(query, {"online": True})

        if response.get("data", {}).get("listCars"):
            for car in response["data"]["listCars"]:
                if car.get("ComputerName") == car_name:
                    return car["InstanceId"], True

        response = appsync_helpers.run_query(query, {"online": False})

        if response.get("data", {}).get("listCars"):
            for car in response["data"]["listCars"]:
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

            logger.info(f"Successfully extracted files to {tmp_dir}")
            return extracted_files

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
