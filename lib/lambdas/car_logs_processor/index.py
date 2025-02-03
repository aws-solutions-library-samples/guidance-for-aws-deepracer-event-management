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

                matched_bags, job_id = process_bag_files(bucket, output_bucket, key)
    elif "data" in event:
        matched_bags, job_id = process_bag_files(
            input_bucket, event["data"]["ssm"]["uploadKey"], output_bucket
        )
    else:
        raise ValueError("Invalid event format")

    return {
        "statusCode": 200,
        "body": {"matched_bags": matched_bags, "batchJobId": job_id},
    }


def process_bag_files(
    input_bucket: str, key: str, output_bucket: str
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

    # Get the car ID from AppSync
    car_id, online = get_car_id(car_name)
    logger.info(f"Found car {car_name} as {car_id}, online: {online}")

    # Get the list of users from AppSync
    all_users = query_users()
    logger.info(f"Input user list: {all_users}")

    # Iterate over the tar.gz files and process them
    try:
        extracted_dirs = download_and_extract_tar(input_bucket, key, EXTRACTED_DIR)

        for bag_dir in extracted_dirs:
            user_model_info = find_user_and_model(all_users.copy(), bag_dir)
            if user_model_info:
                logger.debug(
                    "Found user and model match: {} {}".format(
                        user_model_info["username"],
                        user_model_info["model"]["name"],
                    )
                )

                # Upload the bag into the user's log and video directory
                bag_key = f"private/{user_model_info['sub']}/logs/{bag_dir}"
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
                matched_bags["bags"].append(user_model_info)

        logger.info(f"Matched bags: {matched_bags}")

    except Exception as e:
        logger.error(f"Error processing tar.gz file: {str(e)}")
        raise

    finally:
        clean_directory(EXTRACTED_DIR)

    # Create a batch job for the matched bags
    job_queue = os.environ["JOB_QUEUE"]
    job_definition = os.environ["JOB_DEFINITION"]

    batch_client = boto3.client("batch")

    try:
        response = batch_client.submit_job(
            jobName=f"process-logs-{timestamp}",
            jobQueue=job_queue,
            jobDefinition=job_definition,
            containerOverrides={
                "environment": [
                    {"name": "MATCHED_BAGS", "value": json.dumps(matched_bags)},
                    {"name": "CAR_ID", "value": car_id},
                ]
            },
        )
        logger.info(f"Batch job submitted successfully: {response['jobId']}")
    except Exception as e:
        logger.error(f"Error submitting batch job: {str(e)}")
        raise

    create_dynamodb_entries(matched_bags)

    return matched_bags, response["jobId"]


def create_dynamodb_entries(matched_bags: dict) -> None:

    for bag in matched_bags["bags"]:

        variables = {
            "sub": bag["sub"],
            "username": bag["username"],
            "assetId": hashlib.sha256(bag["bag_key"].encode("utf-8")).hexdigest(),
            "modelId": bag["model"]["id"],
            "modelname": bag["model"]["name"],
            "assetMetaData": {
                "key": bag["bag_key"],
                "filename": bag["bag_key"].split("/")[-1],
                "uploadedDateTime": scalar_types_utils.aws_datetime(),
            },
            "type": "BAG_SQLITE",
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
        ) {
            addCarLogsAsset(
            assetId: $assetId
            assetMetaData: $assetMetaData
            modelId: $modelId
            modelname:  $modelname
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
            modelId
            modelname
            type
            sub
            username
            }
        }
        """

        appsync_helpers.send_mutation(query, variables)


def find_user_and_model(all_users: list[dict], bag_dir: str) -> dict:
    """
    Find the user and model from the bag directory name
    Args:
        bag_dir: Name of the bag directory
    Returns:
        Tuple containing the user and model
    """

    # Example bag_dir: user1-model1-20210901-123456
    # Both user and model names can contain hyphen!

    # Search for unique username:
    candidate_user_model = []

    bag_name_split = bag_dir.split("-")
    for segment in range(1, len(bag_name_split) - 3):
        user_prefix = "-".join(bag_name_split[:segment])
        logger.info(f"Checking for user prefix: {user_prefix}")

        for user in all_users[:]:
            username = user["username"]
            logger.info(f"Checking user {username} {user_prefix}")

            if user["username"] == user_prefix:
                candidate_user_model.append(
                    (user, {"name": "-".join(bag_name_split[segment:-2])})
                )
                all_users.remove(user)
            elif not user["username"].startswith("-".join(user_prefix)):
                all_users.remove(user)

        if len(candidate_user_model) > 0:
            logger.info(
                f"Found candidate user / model combinations: {candidate_user_model}"
            )
            break

    if len(candidate_user_model) == 0:
        logger.warning(f"Could not find user / model match for {bag_dir}")
        return None

    matched_model = {}

    # Iterate over the proposed user / model combinations and check if the model exists
    for user, model_name in candidate_user_model:
        # Check if the model exists
        model_info = query_model(user["sub"], model_name["name"])
        if model_info:
            matched_model["model"] = model_info
            matched_model["username"] = user["username"]
            matched_model["sub"] = user["sub"]
        else:
            candidate_user_model.remove((user, model_name))

    # No candidate found - can't proceed
    if len(candidate_user_model) == 0:
        logger.warning(f"Could not find user / model match for {bag_dir}")
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


def query_users() -> list[dict]:
    """
    Query AppSync to check if a user exists and get their ID
    Returns:
        List of user IDs and their unique identifiers
    Raises:
        Exception if no users found or error occurs
    """

    query = """
    query listUsers {
        listUsers {
            sub
            Username
        }    
    }
    """

    try:
        users = []

        response = appsync_helpers.run_query(query, {})

        if response.get("data", {}).get("listUsers"):
            for user in response["data"]["listUsers"]:
                users.append({"username": user["Username"], "sub": user["sub"]})
            logger.info(f"Found users: {users}")
            return users
        else:
            raise Exception(f"No users found!")

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
