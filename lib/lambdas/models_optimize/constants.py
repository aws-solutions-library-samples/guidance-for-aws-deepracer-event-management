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
from enum import Enum


# Static variables
# Path where the Intel OpenVino is installed.
INTEL_PATH = os.environ["INTEL_CVSDK_DIR"] + "/deployment_tools/model_optimizer/"

PYTHON_BIN = "python3"

# Max retry count
MAX_OPTIMIZER_RETRY_COUNT = 1


class SensorInputTypes(Enum):
    """Enum listing the sensors input types supported; as we add sensors we should add
       inputs. This is also important for networks with more than one input.
    """
    OBSERVATION = 1
    LIDAR = 2
    SECTOR_LIDAR = 3
    LEFT_CAMERA = 4
    FRONT_FACING_CAMERA = 5
    STEREO_CAMERAS = 6

    @classmethod
    def has_member(cls, input_key: str):
        """Check if the input_key passed as parameter is one of the class members.

        Args:
            input_key (str): String containing sensor input key to check.

        Returns:
            bool: Returns True if the sensor input key is supported, False otherwise.
        """
        return input_key.upper() in cls.__members__

class TrainingAlgorithms(Enum):
    """Enum listing the training algorithms supported.
    """
    CLIPPED_PPO = 1
    SAC = 2

    @classmethod
    def has_member(cls, training_algorithm: str):
        """Check if the training_algorithm passed as parameter is one of the class members.

        Args:
            training_algorithm (str): String containing training algorithm to check.

        Returns:
            bool: Returns True if the training algorithm is supported, False otherwise.
        """
        return training_algorithm.upper() in cls.__members__

# Mapping between the training algorithm and input head network names.
INPUT_HEAD_NAME_MAPPING = {
    TrainingAlgorithms.CLIPPED_PPO: "main",
    TrainingAlgorithms.SAC: "policy"
}


# Mapping between input names formats in the network for each input head.
# This will be used during model optimizer and model inference.
NETWORK_INPUT_FORMAT_MAPPING = {
    SensorInputTypes.OBSERVATION: "main_level/agent/{}/online/network_0/observation/observation",
    SensorInputTypes.LIDAR: "main_level/agent/{}/online/network_0/LIDAR/LIDAR",
    SensorInputTypes.SECTOR_LIDAR: "main_level/agent/{}/online/network_0/SECTOR_LIDAR/SECTOR_LIDAR",
    SensorInputTypes.LEFT_CAMERA: "main_level/agent/{}/online/network_0/LEFT_CAMERA/LEFT_CAMERA",
    SensorInputTypes.FRONT_FACING_CAMERA: "main_level/agent/{}/online/network_0/FRONT_FACING_CAMERA/FRONT_FACING_CAMERA",
    SensorInputTypes.STEREO_CAMERAS: "main_level/agent/{}/online/network_0/STEREO_CAMERAS/STEREO_CAMERAS"
}


# Mapping input channel size in the network for each input head except lidar.
INPUT_CHANNEL_SIZE_MAPPING = {
    SensorInputTypes.OBSERVATION: 1,
    SensorInputTypes.LEFT_CAMERA: 1,
    SensorInputTypes.FRONT_FACING_CAMERA: 1,
    SensorInputTypes.STEREO_CAMERAS: 2
}


# Mapping input shape format in the network for each input head.
# This will be used during model optimizer and model inference.
INPUT_SHAPE_FORMAT_MAPPING = {
    SensorInputTypes.OBSERVATION: "[{},{},{},{}]",
    SensorInputTypes.LIDAR: "[{},{}]",
    SensorInputTypes.SECTOR_LIDAR: "[{},{}]",
    SensorInputTypes.LEFT_CAMERA: "[{},{},{},{}]",
    SensorInputTypes.FRONT_FACING_CAMERA: "[{},{},{},{}]",
    SensorInputTypes.STEREO_CAMERAS: "[{},{},{},{}]"
}


class MultiHeadInputKeys(object):
    """Class to store keys required to enable multi head inputs.
    """
    INPUT_HEADS = "--input-names"
    INPUT_CHANNELS = "--input-channels"


class MOKeys(object):
    """Class that statically stores Intel"s model optimizer cli flags. Order doesnot matter.
    """
    MODEL_PATH = "--input_model"
    MODEL_NAME = "--model_name"
    DATA_TYPE = "--data_type"
    DISABLE_FUSE = "--disable_fusing"
    DISABLE_GFUSE = "--disable_gfusing"
    REV_CHANNELS = "--reverse_input_channels"
    OUT_DIR = "--output_dir"
    INPUT_SHAPE = "--input_shape"
    INPUT_SHAPE_DELIM = ","
    INPUT_SHAPE_FMT = "[{},{},{},{}]"


class APIFlags(object):
    """Class for storing API flags, get_list method order must match the APIDefaults
       get list method.
    """
    MODELS_DIR = "--models-dir"
    OUT_DIR = "--output-dir"
    IMG_FORMAT = "--img-format"
    IMG_CHANNEL = "--img-channels"
    PRECISION = "--precision"
    FUSE = "--fuse"
    SCALE = "--scale"
    INPUT = "--input"
    OUTPUT = "--output"
    MEAN_VAL = "--mean_values"
    EXT = "--extensions"

    @staticmethod
    def get_list():
        """Static method returns an ordered list of available model optimizer API flags,
           this list should maintain the same order as the get_list method of the
           APIDefaults class.

        Returns:
            list: List of class variable values.
        """
        return [APIFlags.MODELS_DIR, APIFlags.OUT_DIR, APIFlags.IMG_FORMAT, APIFlags.IMG_CHANNEL,
                APIFlags.PRECISION, APIFlags.FUSE, APIFlags.SCALE, APIFlags.INPUT,
                APIFlags.OUTPUT, APIFlags.MEAN_VAL, APIFlags.EXT]


class APIDefaults(object):
    """Class for storing API default values, get_list method order must match the APIFlags
       get list method.
    """
    MODELS_DIR = "/models"
    OUT_DIR = "/models"
    IMG_FORMAT = "BGR"
    IMG_CHANNEL = 3
    PRECISION = "FP16"
    FUSE = "ON"
    SCALE = 1
    INPUT = ""
    OUTPUT = ""
    MEAN_VAL = ""
    EXT = ""

    @staticmethod
    def get_list():
        """Static method returns an ordered list of available model optimizer API flag defaults,
           this list should maintain the same order as the get_list method of the
           APIFlags class.

        Returns:
            list: List of class variable values.
        """
        return [APIDefaults.MODELS_DIR, APIDefaults.OUT_DIR, APIDefaults.IMG_FORMAT,
                APIDefaults.IMG_CHANNEL, APIDefaults.PRECISION, APIDefaults.FUSE,
                APIDefaults.SCALE, APIDefaults.INPUT, APIDefaults.OUTPUT,
                APIDefaults.MEAN_VAL, APIDefaults.EXT]

class ModelMetadataKeys():
    """Class with keys in the model metadata.json
    """
    SENSOR = "sensor"
    LIDAR_CONFIG = "lidar_config"
    TRAINING_ALGORITHM = "training_algorithm"
    NUM_LIDAR_SECTORS = "num_sectors"
    USE_LIDAR = "use_lidar"


# Default Lidar configuration values
DEFAULT_LIDAR_CONFIG = {
    # Number of lidar sectors to feed into network
    ModelMetadataKeys.NUM_LIDAR_SECTORS: 64,
}

# Default Sector Lidar configuration values
DEFAULT_SECTOR_LIDAR_CONFIG = {
    # Number of lidar sectors to feed into network
    ModelMetadataKeys.NUM_LIDAR_SECTORS: 8
}

MODEL_METADATA_NAME = "model_metadata.json"