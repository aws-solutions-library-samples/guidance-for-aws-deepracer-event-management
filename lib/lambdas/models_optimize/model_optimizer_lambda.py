#!/usr/bin/env python

#################################################################################
#   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.          #
#                                                                               #
#   Licensed under the Apache License, Version 2.0 (the "License").             #
#   You may not use this file except in compliance with the License.            #
#   You may obtain a copy of the License at                                     #
#                                                                               #
#       http://www.apache.org/licenses/LICENSE-2.0                              #
#                                                                               #
#   Unless required by applicable law or agreed to in writing, software         #
#   distributed under the License is distributed on an "AS IS" BASIS,           #
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.    #
#   See the License for the specific language governing permissions and         #
#   limitations under the License.                                              #
#################################################################################

"""
model_optimizer_lambda.py

This module is the model_optimizer_lambda which is responsible for running the Intel
OpenVino model optimizer script for the DeepRacer reinforcement learning models to
obtain the intermediate representation xml files and other optimizer artifacts required
to run the inference with the model.

The lambda is a mash-up of the code provided by the aws-deepracer-model-optimizer-pkg
and the aws-deepracer-systems-pkg, allowing for the optimization of models outside of
the DeepRacer

"""

import hashlib
import json
import os

import appsync_helpers
import boto3
import constants
import file_utils
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
from model_optimizer import ModelOptimizer

logger = Logger()

session = boto3.session.Session()
client_s3 = boto3.client("s3")

DESTINATION_BUCKET = os.environ["DESTINATION_BUCKET"]


@logger.inject_lambda_context
def lambda_handler(event, context):
    logger.info(json.dumps(event))

    payload = event["detail"]["responsePayload"]

    model_key = payload["target_key"]
    model_id = hashlib.sha256(model_key.encode("utf-8")).hexdigest()
    src_bucket = payload["target_bucket"]
    status = payload["status"]

    model_key_parts = model_key.split("/")
    model_sub = model_key_parts[1]
    model_filename = model_key_parts[-1]

    model_name = model_filename.split(".")[0]
    model_target_file = os.path.join(constants.APIDefaults.TMP_DIR, model_filename)
    model_target_dir = os.path.join(constants.APIDefaults.MODELS_DIR, model_name)

    if not os.path.isdir(constants.APIDefaults.TMP_DIR):
        os.makedirs(constants.APIDefaults.TMP_DIR)

    if status == "AVAILABLE":
        client_s3.download_file(
            src_bucket,
            model_key,
            os.path.join(constants.APIDefaults.TMP_DIR, model_target_file),
        )
        # Get the tags of the downloaded file as we'
        s3_object_tags = client_s3.get_object_tagging(
            Bucket=src_bucket,
            Key=model_key
        )['TagSet']

        if not os.path.isdir(model_target_dir):
            os.makedirs(model_target_dir)

        logger.info(f"Extracting into {model_target_file}")
        file_utils.extract_archive(model_target_file, model_target_dir, clean=True)

        mo = ModelOptimizer(logger)
        error_code, error_msg, artifact_path = mo.optimize(model_name)

        if error_code == 0:
            logger.info(f"Optimized model to file {artifact_path}")

            archive_file = file_utils.compress_archive(
                model_target_dir, constants.APIDefaults.TMP_DIR
            )

            if archive_file is None:
                logger.error("Compressing model to archive fail.")
                return

            try:
                #Add the same tags as the downloaded file when uploading the optimized model
                client_s3.upload_file(archive_file, src_bucket, model_key,ExtraArgs={'Tagging': '&'.join([f"{tag['Key']}={tag['Value']}" for tag in s3_object_tags])})
                logger.info(
                    f"Uploading {archive_file} to s3://{src_bucket}/{model_key} with tags {s3_object_tags}"
                )
            except ClientError as e:
                logger.error(f"Error in uploading {archive_file}", e)
                return

            query = """
                    mutation UpdateModel(
                        $modelId: ID!
                        $status: ModelStatusEnum
                        $sub: ID!
                    ) {
                        updateModel(
                        modelId: $modelId
                        status: $status
                        sub: $sub
                        ) {
                        fileMetaData {
                            filename
                            key
                            uploadedDateTime
                        }
                        modelId
                        modelMD5
                        modelMetaData {
                            actionSpaceType
                            metadataMd5
                            sensor
                            trainingAlgorithm
                        }
                        modelname
                        status
                        sub
                        username
                        }
                    }
                    """

            appsync_helpers.send_mutation(
                query,
                {"modelId": model_id, "sub": model_sub, "status": "OPTIMIZED"},
            )

        else:
            logger.error(f"Optimizing model failed with code {error_code}")
