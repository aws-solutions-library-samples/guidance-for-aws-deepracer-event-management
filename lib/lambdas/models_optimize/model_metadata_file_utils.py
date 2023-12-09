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

import os
import json

import constants


def read_model_metadata_file(model_metatdata_file):
    """Helper method that reads the model metadata file for the model selected.

    Args:
        model_metatdata_file (str): Path to the model_metadata file.

    Returns:
        tuple: Tuple of (error_code, error_message, json object
               read from model_metadata.json file).
    """
    try:
        err_msg = ""
        if(not os.path.isfile(model_metatdata_file)):
            err_msg = "No model_metadata_file for the model selected"
            return 1, err_msg, {}
        with open(model_metatdata_file) as json_file:
            data = json.load(json_file)

        return 0, err_msg, data
    except Exception as exc:
        return 1, f"Error while reading model_metadata.json: {exc}", {}


def get_sensors(model_metatdata_json):
    """Helper method that returns the corresponding enum values for sensors in the
       model_metadata json of the model selected.

    Args:
        model_metatdata_json (dict): JSON object with contents of the model metadata file.

    Returns:
        tuple: Tuple of (error_code, error_message, list of integer values
               corresponding the sensors of the model).
    """
    try:
        sensors = None
        err_msg = ""
        if constants.ModelMetadataKeys.SENSOR in model_metatdata_json:
            sensor_names = set(model_metatdata_json[constants.ModelMetadataKeys.SENSOR])
            if all([constants.SensorInputTypes.has_member(sensor_name) for sensor_name in sensor_names]):
                sensors = [constants.SensorInputTypes[sensor_name.upper()].value for sensor_name in sensor_names]
            else:
                return 2, "The sensor configurations of your vehicle and trained model must match", []
        else:
            # To handle DeepRacer models with no sensor key
            err_msg = "No sensor key in model_metadata_file. Defaulting to observation."
            sensors = [constants.SensorInputKeys.observation.value]

        return 0, err_msg, sensors
    except Exception as exc:
        return 1, f"Error while getting sensor names from model_metadata.json: {exc}", []


def get_training_algorithm(model_metadata_json):
    """Helper method that returns the corresponding enum value for the training algorithm in the
       model_metadata json of the model selected.

    Args:
        model_metadata_json (dict): JSON object with contents of the model metadata file.

    Returns:
        tuple: Tuple of (error_code, error_message, integer value
               corresponding the training algorithm of the model).
    """
    try:
        training_algorithm = None
        err_msg = ""
        if constants.ModelMetadataKeys.TRAINING_ALGORITHM in model_metadata_json:
            training_algorithm_value = model_metadata_json[constants.ModelMetadataKeys.TRAINING_ALGORITHM]
            if constants.TrainingAlgorithms.has_member(training_algorithm_value):
                training_algorithm = constants.TrainingAlgorithms[training_algorithm_value.upper()]
            else:
                return 2, "The training algorithm value is incorrect", ""
        else:
            # To handle DeepRacer models with no training_algorithm key
            print("No training algorithm key in model_metadata_file. Defaulting to clipped_ppo.")
            training_algorithm = constants.TrainingAlgorithms.CLIPPED_PPO.value

        return 0, err_msg, training_algorithm
    except Exception as exc:
        return 1, f"Error while getting training algorithm model_metadata.json: {exc}", ""


def load_lidar_configuration(sensors, model_metadata):
    """Helper method to load the LiDAR configuration based on type of
       preprocessing done on the LiDAR data duringthe model training.

    Args:
        sensors (list): List of integers corresponding to the sensor enum values
                        for the trained model.
        model_metadata (dict): JSON object with contents of the model metadata file.

    Returns:
        tuple: Tuple of (error_code, error_message, dictionary with model lidar configuration
               corresponding the preprocessing done on LiDAR data during model training).
    """
    try:
        # Set default values in case the 'lidar configuration' is not defined in model_metadata.json
        model_lidar_config = constants.DEFAULT_LIDAR_CONFIG
        # Set default values for SECTOR_LIDAR if this sensor is used
        if constants.SensorInputTypes.SECTOR_LIDAR in sensors:
            model_lidar_config = constants.DEFAULT_SECTOR_LIDAR_CONFIG
        model_lidar_config[
            constants.ModelMetadataKeys.USE_LIDAR
        ] = sensors and (constants.SensorInputTypes.LIDAR in sensors
                         or constants.SensorInputTypes.SECTOR_LIDAR in sensors)
        # Load the lidar configuration if the model uses lidar and has custom lidar configurations
        if model_lidar_config[constants.ModelMetadataKeys.USE_LIDAR] \
           and constants.ModelMetadataKeys.LIDAR_CONFIG in model_metadata:
            lidar_config = model_metadata[constants.ModelMetadataKeys.LIDAR_CONFIG]
            model_lidar_config[
                constants.ModelMetadataKeys.NUM_LIDAR_SECTORS
            ] = lidar_config[constants.ModelMetadataKeys.NUM_LIDAR_SECTORS]
        return 0, "", model_lidar_config
    except Exception as exc:
        return 1, f"Unable to connect to device with current LiDAR configuration: {exc}", {}
