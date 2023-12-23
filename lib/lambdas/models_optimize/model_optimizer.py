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
model_optimizer.py

This module is the model_optimizer which is responsible for running the Intel
OpenVino model optimizer script for the DeepRacer reinforcement learning models to
obtain the intermediate representation xml files and other optimizer artifacts
required to run the inference with the model.

More details:
(https://docs.openvinotoolkit.org/2021.1/openvino_docs_MO_DG_Deep_Learning_Model_Optimizer_DevGuide.html)

    "The optimizer performs static model analysis, and adjusts deep
    learning models for optimal execution on end-point target devices."


The lambda is a mash-up of the code provided by the aws-deepracer-model-optimizer-pkg
and the aws-deepracer-systems-pkg, allowing for the optimization of models outside of
the DeepRacer

"""

import os
import re
import shlex
import subprocess

import constants
import model_metadata_file_utils


class ModelOptimizer:
    """Class responsible for running the Intel OpenVino model optimizer for the
    DeepRacer models.
    """

    def __init__(self, logger):
        """Create a ModelOptimizer."""
        self.logger = logger
        self.logger.info("ModelOptimizer started")

    def optimize(self, model_name):
        """Main function to execute a model optimization.

        Args:
            model_name (str): Name of the model to be optimized.

        """

        model_folder = os.path.join(constants.APIDefaults.MODELS_DIR, model_name)
        model_metadata_file_path = os.path.join(
            model_folder, constants.MODEL_METADATA_NAME
        )

        if not os.path.isfile(model_metadata_file_path):
            self.logger.error(f"Metadata file not found: {model_metadata_file_path}")
            return 1, f"Metadata file not found: {model_metadata_file_path}", None

        self.logger.info(f"read model_metadata_file from {model_metadata_file_path}...")
        (
            err_code,
            err_msg,
            model_metadata_content,
        ) = model_metadata_file_utils.read_model_metadata_file(model_metadata_file_path)

        if err_code != 0:
            self.logger.error(
                "Error while getting sensor names from "
                f"{model_metadata_file_path}: {err_msg}"
            )
            return err_code, err_msg, None

        # Get the sensor information of the model from the model_metadata.json.
        (
            err_code,
            err_msg,
            model_metadata_sensors,
        ) = model_metadata_file_utils.get_sensors(model_metadata_content)
        if err_code != 0:
            self.logger.error(
                "Error while getting sensor names from "
                f"{model_metadata_file_path}: {err_msg}"
            )
            return err_code, err_msg, None
        self.logger.info(
            "Sensor names read from "
            f"{model_metadata_file_path}: {model_metadata_sensors}"
        )

        # Get the training algorithm information of the model from the
        # model_metadata.json.
        (
            err_code,
            err_msg,
            training_algorithm,
        ) = model_metadata_file_utils.get_training_algorithm(model_metadata_content)
        if err_code != 0:
            self.logger.error(
                "Error while getting training algorithm from "
                f"{model_metadata_file_path}: {err_msg}"
            )
            return err_code, err_msg, None
        self.logger.info(
            "Training algorithm read from "
            f"{model_metadata_file_path}: {training_algorithm}"
        )

        # Get the LiDAR configuration if passed for the model from the
        # model_metadata.json.
        (
            err_code,
            err_msg,
            model_lidar_config,
        ) = model_metadata_file_utils.load_lidar_configuration(
            model_metadata_sensors, model_metadata_content
        )
        if err_code != 0:
            self.logger.error(
                "Error while getting LiDAR configuration from "
                f"{model_metadata_file_path}: {err_msg}"
            )
            return err_code, err_msg, None
        self.logger.info(
            "LiDAR configuration read from "
            f"{model_metadata_file_path}: {model_lidar_config}"
        )

        try:
            aux_param = {
                "--fuse": "OFF",
                "--img-format": constants.APIDefaults.IMG_FORMAT,
            }
            error_code, artifact_path = self.optimize_tf_model(
                "{}/agent/model".format(model_name),
                model_metadata_sensors,
                training_algorithm,
                160,
                120,
                model_lidar_config[constants.ModelMetadataKeys.NUM_LIDAR_SECTORS],
                aux_param,
            )

            if error_code == 0:
                self.logger.info(f"Optimized artifact available in : {artifact_path}")
                return error_code, "", artifact_path

        except Exception as ex:
            self.logger.error(f"Error while optimizing model: {ex}")
            return 1, "Error"

    def convert_to_mo_cli(
        self,
        model_name,
        model_metadata_sensors,
        training_algorithm,
        input_width,
        input_height,
        lidar_channels,
        aux_inputs,
    ):
        """Helper method that converts the information in model optimizer API into
           the appropriate cli commands.

        Args:
            model_name (str): Model prefix, should be the same in the weight and
                              symbol file.
            model_metadata_sensors (list): List of sensor input types(int) for all
                                           the sensors with which the model was trained.
            training_algorithm (int): Training algorithm key(int) for the algorithm
                                      with which the model was trained.
            input_width (int): Width of the input image to the inference engine.
            input_height (int): Height of the input image to the inference engine.
            lidar_channels (int): Number of LiDAR values that with which the LiDAR head
                                  of the model was trained.
            aux_inputs (dict): Dictionary of auxiliary options for the model optimizer.

        Raises:
            Exception: Custom exception if the API flags and default values are not
                       aligned.
            Exception: Custom exception if the lidar_channel value is less than 1.

        Returns:
            dict: Map of parameters to be passed to model optimizer command based
                  on the model.
        """
        if len(constants.APIFlags.get_list()) != len(constants.APIDefaults.get_list()):
            raise Exception("Inconsistent API flags")
        # Set the flags tot he default values.
        default_param = {}
        for flag, value in zip(
            constants.APIFlags.get_list(), constants.APIDefaults.get_list()
        ):
            default_param[flag] = value
        # Set param values to the values to the user entered values in aux_inputs.
        for flag, value in aux_inputs.items():
            if flag in default_param:
                default_param[flag] = value

        # Dictionary that will house the cli commands.
        common_params = {}
        # Convert API information into appropriate cli commands.
        for flag, value in default_param.items():
            if flag is constants.APIFlags.MODELS_DIR:
                common_params[constants.MOKeys.MODEL_PATH] = os.path.join(
                    value, model_name
                )
            # Input shape is in the for [n,h,w,c] to support tensorflow models only
            elif flag is constants.APIFlags.IMG_CHANNEL:
                common_params[
                    constants.MOKeys.INPUT_SHAPE
                ] = constants.MOKeys.INPUT_SHAPE_FMT.format(
                    1, input_height, input_width, value
                )
            elif flag is constants.APIFlags.PRECISION:
                common_params[constants.MOKeys.DATA_TYPE] = value
            elif flag is constants.APIFlags.FUSE:
                if value is not constants.APIDefaults.FUSE:
                    common_params[constants.MOKeys.DISABLE_FUSE] = ""
                    common_params[constants.MOKeys.DISABLE_GFUSE] = ""
            elif flag is constants.APIFlags.IMG_FORMAT:
                if value is constants.APIDefaults.IMG_FORMAT:
                    common_params[constants.MOKeys.REV_CHANNELS] = ""
            elif flag is constants.APIFlags.OUT_DIR:
                common_params[constants.MOKeys.OUT_DIR] = value
            # Only keep entries with non-empty string values.
            elif value:
                common_params[flag] = value

        # Override the input shape and the input flags to handle multi head inputs in
        # tensorflow
        input_shapes = []
        input_names = []
        training_algorithm_key = constants.TrainingAlgorithms(training_algorithm)

        for input_type in model_metadata_sensors:
            input_key = constants.SensorInputTypes(input_type)
            if (
                input_key == constants.SensorInputTypes.LIDAR
                or input_key == constants.SensorInputTypes.SECTOR_LIDAR
            ):
                if lidar_channels < 1:
                    raise Exception("Lidar channels less than 1")
                input_shapes.append(
                    constants.INPUT_SHAPE_FORMAT_MAPPING[input_key].format(
                        1, lidar_channels
                    )
                )
            else:
                # Input shape is in the for [n,h,w,c] to support tensorflow models only
                input_shapes.append(
                    constants.INPUT_SHAPE_FORMAT_MAPPING[input_key].format(
                        1,
                        input_height,
                        input_width,
                        constants.INPUT_CHANNEL_SIZE_MAPPING[input_key],
                    )
                )
            input_name_format = constants.NETWORK_INPUT_FORMAT_MAPPING[input_key]
            input_names.append(
                input_name_format.format(
                    constants.INPUT_HEAD_NAME_MAPPING[training_algorithm_key]
                )
            )

        if len(input_names) > 0 and len(input_shapes) == len(input_names):
            common_params[
                constants.MOKeys.INPUT_SHAPE
            ] = constants.MOKeys.INPUT_SHAPE_DELIM.join(input_shapes)
            common_params[
                constants.APIFlags.INPUT
            ] = constants.MOKeys.INPUT_SHAPE_DELIM.join(input_names)

        common_params[constants.MOKeys.MODEL_NAME] = model_name
        return common_params

    def run_optimizer(self, mo_path, common_params, platform_parms):
        """Helper method that combines the common commands with the platform specific
           commands.
        Args:
            mo_path (str): Path to intel"s model optimizer for a given platform
                           (mxnet, caffe, or tensor flow).
            common_params (dict): Dictionary containing the cli flags common to all
                                  model optimizer.
            platform_parms (dict): Dictionary containing the cli flags for the specific
                                   platform.

        Raises:
            Exception: Custom exception if the model file is not present.

        Returns:
            tuple: Tuple whose first value is the error code and second value
                   is a string to the location of the converted model if any.
        """
        if not os.path.isfile(common_params[constants.MOKeys.MODEL_PATH]):
            raise Exception(
                f"Model file {common_params[constants.MOKeys.MODEL_PATH]} not found"
            )
        cmd = f"{constants.PYTHON_BIN} {constants.INTEL_PATH}{mo_path}"
        # Construct the cli command
        for flag, value in dict(common_params, **platform_parms).items():
            cmd += f" {flag} {value}"

        self.logger.info(f"Model optimizer command: {cmd}")
        tokenized_cmd = shlex.split(cmd)

        retry_count = 0
        # Retry running the optimizer if it fails due to any error
        # The optimizer command is run for MAX_OPTIMIZER_RETRY_COUNT + 1 times
        while retry_count <= constants.MAX_OPTIMIZER_RETRY_COUNT:
            self.logger.info(
                f"Optimizing model: {retry_count} of "
                f"{constants.MAX_OPTIMIZER_RETRY_COUNT} trials"
            )
            proc = subprocess.Popen(tokenized_cmd, stderr=subprocess.PIPE)
            _, std_err = proc.communicate()
            if not proc.returncode:
                return 0, os.path.join(
                    common_params[constants.MOKeys.OUT_DIR],
                    f"{common_params[constants.MOKeys.MODEL_NAME]}.xml",
                )
            std_err = re.sub(r", question #\d+", "", std_err.decode("utf-8"))
            self.logger.error(f"Model optimizer error info: {std_err}")
            retry_count += 1
        # Return error code 1, which means that the model optimizer failed even after
        # retries.
        return 1, ""

    def set_platform_param(self, platform_param, aux_inputs):
        """Helper method that creates a dictionary with the platform specific
           Intel model optimizer cli commands.

        Args:
            platform_param (dict): Dictionary of available platform cli commands.
            aux_inputs (dict): Dictionary of auxiliary options for the model optimizer.

        Returns:
            dict: Dictionary with platform specific params set if present in aux_inputs.
        """
        self.logger.info(f"aux_inputs: {aux_inputs} ")
        set_paltform_params = {}
        for flag in platform_param:
            if flag in aux_inputs:
                set_paltform_params[flag] = aux_inputs[flag]
        return set_paltform_params

    def optimize_tf_model(
        self,
        model_name,
        model_metadata_sensors,
        training_algorithm,
        input_width,
        input_height,
        lidar_channels,
        aux_inputs={},
    ):
        """Helper function to run Intel"s model optimizer for DeepRacer tensorflow
           model.

        Args:
            model_name (str): Model prefix, should be the same in the weight and symbol
                              file.
            model_metadata_sensors (list): List of sensor input types(int) for all the
                                           sensors with which the model was trained.
            training_algorithm (int): Training algorithm key(int) for the algorithm
                                      with which the model was trained.
            input_width (int): Width of the input image to the inference engine.
            input_height (int): Height of the input image to the inference engine.
            lidar_channels (int): Number of LiDAR values that with which the LiDAR head
                                  of the model was trained.
            aux_inputs (dict, optional): Dictionary of auxiliary options for the model
                                         optimizer. Defaults to {}.

        Raises:
            Exception: Custom exception if the input height or width is less than 1.

        Returns:
            tuple: Tuple whose first value is the error code and second value
                   is a string to the location of the converted model if any.
        """
        if input_width < 1 or input_height < 1:
            raise Exception("Invalid height or width")
        # Convert the API information into Intel model optimizer cli commands.
        common_params = self.convert_to_mo_cli(
            model_name,
            model_metadata_sensors,
            training_algorithm,
            input_width,
            input_height,
            lidar_channels,
            aux_inputs,
        )
        # Tensor Flow specific parameters.
        tf_params = {
            "--input_model_is_text": "",
            "--offload_unsupported_operations_to_tf": "",
            "--tensorflow_subgraph_patterns": "",
            "-tensorflow_operation_patterns": "",
            "--tensorflow_custom_operations_config_update": "",
            "--tensorflow_use_custom_operations_config": "",
        }
        # Add the correct file suffix.
        common_params[constants.MOKeys.MODEL_PATH] += (
            ".pbtxt" if "--input_model_is_text" in aux_inputs else ".pb"
        )
        return self.run_optimizer(
            "mo_tf.py", common_params, self.set_platform_param(tf_params, aux_inputs)
        )
