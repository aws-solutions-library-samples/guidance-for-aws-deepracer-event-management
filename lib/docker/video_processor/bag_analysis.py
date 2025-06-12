#!/usr/bin/env python3
import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # or any {'0', '1', '2'}

import argparse
import datetime
import heapq
import multiprocessing as mp
import queue
import signal
from typing import Dict, List, Tuple

import cv2
import matplotlib
import numpy as np
import pandas as pd
import psutil
import rclpy.logging  # type: ignore
import utils
from cv_bridge import CvBridge  # type: ignore
from deepracer_interfaces_pkg.msg import InferResultsArray  # type: ignore
from deepracer_viz.gradcam.cam import GradCam
from deepracer_viz.model.metadata import ModelMetadata
from deepracer_viz.model.model import Model
from matplotlib import font_manager as fm
from matplotlib import gridspec
from matplotlib import pyplot as plt
from matplotlib import rcParams
from rclpy.serialization import deserialize_message  # type: ignore
from tqdm.auto import tqdm

matplotlib.use("Agg")

bridge = CvBridge()
WIDTH = 1280
HEIGHT = 720

# Define global color constants
COLOR_EDGE = "#a783e1"
COLOR_HIGHLIGHT = "#ff9900"
COLOR_TEXT_PRIMARY = "#a166ff"
COLOR_TEXT_SECONDARY = "lightgray"
COLOR_BACKGROUND = "black"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_BIG = fm.FontProperties(
    fname=os.path.join(SCRIPT_DIR, "resources", "Amazon_Ember_Rg.ttf"), size=20
)
FONT_BIG_BD = fm.FontProperties(
    fname=os.path.join(SCRIPT_DIR, "resources", "Amazon_Ember_Bd.ttf"), size=25
)
FONT_SMALL = fm.FontProperties(
    fname=os.path.join(SCRIPT_DIR, "resources", "Amazon_Ember_Rg.ttf"), size=15
)

procs = []


def signal_handler(sig, frame):
    for p in procs:
        p.terminate()

    print("All worker processes stopped.")
    exit(1)


def process_worker(
    data_queue: mp.Queue,
    result: Tuple,
    model_bytes: bytes,
    metadata: ModelMetadata,
    bag_info: dict,
    background: np.ndarray,
    action_names: List[str],
    error_queue: mp.Queue = None,  # Add error queue parameter
):
    """
    Worker function to process data frames using a machine learning model and Grad-CAM for visualization.

    Args:
        data_queue (mp.Queue): Queue from which to read data frames to process.
        result_queue (mp.Queue): Queue to which to put processed results.
        model_bytes (bytes): Model loaded into bytes.
        metadata (ModelMetadata): Metadata associated with the model.
        bag_info (dict): Dictionary containing information about the data bag.
        background (np.ndarray): Background image to use for visualization.
        action_names (List[str]): List of action names for labeling.

    Raises:
        Exception: If an error occurs during frame processing.
    """

    try:
        result_list, list_lock = result
        flip_x = bag_info.get("flip_x", False)

        fig = create_plot(
            action_names,
            flip_x,
            HEIGHT,
            WIDTH,
            72,
            transparent=(background is not None),
        )

        model = Model.from_bytes(
            model_bytes=model_bytes, metadata=metadata, log_device_placement=False
        )

        with model.session as _:
            cam = GradCam(model, model.get_conv_outputs())

            while True:
                try:
                    task_data = data_queue.get(timeout=1)
                    if task_data is None:
                        break

                    index, data = task_data
                    step, img, grad_img = process_input_frame(
                        data, start_time=bag_info["start_time"], seq=index, cam=cam
                    )
                    encimg = create_img(
                        fig,
                        step,
                        bag_info,
                        img,
                        grad_img,
                        action_names,
                        flip_x,
                        background,
                    )

                    with list_lock:
                        result_list.append([index, step, encimg])

                except queue.Empty:
                    continue
                except Exception as frame_error:
                    # Log frame-specific errors but continue processing
                    error_msg = f"Worker {os.getpid()}: Error processing frame {index if 'index' in locals() else 'unknown'}: {frame_error}"
                    print(error_msg)
                    if error_queue:
                        error_queue.put(("frame_error", error_msg))
                    continue

    except Exception as worker_error:
        # Critical worker initialization/setup errors
        error_msg = (
            f"Worker {os.getpid()}: Critical error in worker setup: {worker_error}"
        )
        print(error_msg)
        if error_queue:
            error_queue.put(("worker_error", error_msg))
        return  # Exit worker process

    finally:
        # Cleanup resources
        try:
            if "fig" in locals():
                plt.close(fig)
        except Exception as cleanup_error:
            print(f"Worker {os.getpid()}: Error during cleanup: {cleanup_error}")


def create_plot(
    action_names: List[str],
    flip_x: bool,
    height: float,
    width: float,
    dpi: int,
    transparent: bool = False,
) -> matplotlib.figure.Figure:
    """
    Create a plot with four subplots using matplotlib.

    Args:
        action_names (List[str]): A list of action names.
        flip_x (bool): Whether to flip the x-axis showing the actions.
        height (float): The height of the plot in inches.
        width (float): The width of the plot in inches.
        dpi (int): The resolution of the plot in dots per inch.
        transparent (bool): Whether the plot should have a transparent background.

    Returns:
        matplotlib.figure.Figure: The matplotlib Figure object containing the plot.
    """

    fig = plt.figure(figsize=(width / dpi, height / dpi), dpi=dpi)

    if transparent:
        fig.patch.set_alpha(0.0)
    else:
        fig.set_facecolor(COLOR_BACKGROUND)

    spec = gridspec.GridSpec(
        ncols=4,
        nrows=2,
        width_ratios=[1, 1, 1, 1],
        wspace=0.1,
        hspace=0.1,
        height_ratios=[3.5, 1.2],
        left=0.025,
        right=0.975,
        top=0.925,
        bottom=0.05,
    )
    ax0 = fig.add_subplot(spec[0, :-2])
    ax0.set_xticks([])
    ax0.set_yticks([])
    for spine in ax0.spines.values():
        spine.set_edgecolor(COLOR_EDGE)
        spine.set_linewidth(1)

    ax1 = fig.add_subplot(spec[0, -2:])
    ax1.set_xticks([])
    ax1.set_yticks([])
    for spine in ax1.spines.values():
        spine.set_edgecolor(COLOR_EDGE)
        spine.set_linewidth(1)

    ax2 = fig.add_subplot(spec[1, :])
    ax2.set_ylim(0.0, 1.0)
    ax2.set_facecolor(COLOR_BACKGROUND)
    ax2.set_xticks([])
    ax2.set_yticks([])
    for spine in ax2.spines.values():
        spine.set_edgecolor(COLOR_EDGE)
        spine.set_linewidth(1)

    # Action names means we have a discrete action spaceq
    if len(action_names) > 0:
        if flip_x:
            action_names_display = action_names[::-1]
        else:
            action_names_display = action_names

        for i, label in enumerate(action_names_display):
            ax2.text(
                i,
                0.5,
                label,
                ha="center",
                va="center",
                rotation=90,
                color=COLOR_TEXT_SECONDARY,
                fontproperties=FONT_SMALL,
            )

    return fig


def create_img(
    fig: matplotlib.figure.Figure,
    step: Dict,
    bag_info: Dict,
    img: np.ndarray,
    grad_img: np.ndarray,
    action_names: List[str],
    flip_x: bool,
    background: np.ndarray = None,
) -> np.ndarray:
    """
    Create an image with multiple plots and return it as a cv2 MatLike object.

    Args:
        fig (matplotlib.figure.Figure): The matplotlib Figure object containing the plot.
        step (Dict): A dictionary containing step information.
        bag_info (Dict): A dictionary containing information about the bag file.
        img (np.ndarray): The input image to be displayed in the first plot.
        grad_img (np.ndarray): The gradient image to be displayed in the second plot.
        action_names (List[str]): A list of action names.
        flip_x (bool): Whether to flip the x-axis showing the actions.
        background (np.ndarray): The background image to use for the plot.

    Returns:
        np.ndarray: The resulting image as a cv2 MatLike object.
    """

    timestamp_formatted = "{:02}:{:05.2f}".format(
        int(step["timestamp"] // 60), step["timestamp"] % 60
    )

    # Split bag_info['name'] into parts
    name_parts = bag_info["name"].split("-")
    # Create one string with the last two parts
    start_time = "-".join(name_parts[-2:])
    # Create another string with the rest
    model_name = "-".join(name_parts[:-2])

    # Update left-aligned suptitle
    fig.texts.clear()
    fig.text(
        0.025,
        0.95,
        model_name,
        color=COLOR_TEXT_PRIMARY,
        fontproperties=FONT_BIG_BD,
        ha="left",
    )

    # Add right-aligned suptitle
    fig.text(
        0.975,
        0.95,
        "{} {} / {}".format(start_time, timestamp_formatted, step["seq_0"]),
        color=COLOR_TEXT_SECONDARY,
        fontproperties=FONT_BIG,
        ha="right",
    )

    x = list(range(0, len(action_names)))

    car_result = pd.DataFrame(step["car_results"])

    ax = fig.get_axes()
    for a in ax:
        for p in set(a.containers):
            p.remove()
        for i in set(a.images):
            i.remove()

    ax[0].imshow(img)
    ax[1].imshow(grad_img)

    # If there are action_names it is a discrete action space
    if len(action_names) > 0:
        # Highlight the highest bar in a different color
        bar_colors = [COLOR_EDGE] * len(car_result["probability"])
        max_index = car_result["probability"].idxmax()
        bar_colors[max_index] = COLOR_HIGHLIGHT

        if flip_x:
            ax[2].bar(x, car_result["probability"][::-1], color=bar_colors[::-1])
        else:
            ax[2].bar(x, car_result["probability"], color=bar_colors)

    fig.canvas.draw()

    # Get the canvas buffer and convert it to a numpy array
    buf = fig.canvas.buffer_rgba()
    ncols, nrows = fig.canvas.get_width_height()
    img = np.frombuffer(buf, dtype=np.uint8).reshape(nrows, ncols, 4)

    # Apply background if available
    if background is not None:
        gradient_alpha_rgb_mul, one_minus_gradient_alpha = utils.get_gradient_values(
            img
        )
        img = cv2.cvtColor(
            utils.apply_gradient(
                background.copy(), gradient_alpha_rgb_mul, one_minus_gradient_alpha
            ),
            cv2.COLOR_RGBA2BGR,
        )
    else:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)

    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]  # Adjust the quality as needed
    _, encimg = cv2.imencode(".jpg", img, encode_param)
    return encimg


def process_input_frame(
    data: bytes, start_time: float, seq: int, cam: GradCam
) -> Tuple[Dict, np.ndarray, np.ndarray]:
    """
    Process data from a bag file.

    Args:
        data (bytes): The data to process.
        start_time (float): The start time of the data.
        seq (int): The sequence number of the frame.
        cam (GradCam): The GradCam object used for image processing.

    Returns:
        Tuple[Dict, np.ndarray, np.ndarray]: A tuple containing the processed data, the original image, and the processed image.

    Raises:
        Exception: If an error occurs during the processing.
    """
    try:
        step = {}

        msg = deserialize_message(data, InferResultsArray)

        # Timestamp
        timestamp: float = (
            msg.images[0].header.stamp.sec + msg.images[0].header.stamp.nanosec / 1e9
        )
        timestamp = timestamp - start_time

        step["timestamp"] = timestamp
        step["seq"] = seq  # int(msg.images[0].header.frame_id)
        step["seq_0"] = seq

        # Extract original image from first camera
        cv_img = bridge.compressed_imgmsg_to_cv2(
            msg.images[0], desired_encoding="passthrough"
        )
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_BGRA2RGB)

        # Find best OpenVINO Result
        step["car_action"] = {"action": -1, "probability": -1}
        step["car_results"] = []
        for r in msg.results:
            step["car_results"].append(
                {"action": r.class_label, "probability": r.class_prob}
            )
            if r.class_prob > step["car_action"]["probability"]:
                step["car_action"] = {
                    "action": r.class_label,
                    "probability": r.class_prob,
                }

        # Process image with Tensorflow
        tf_result, grad_img = cam.process(cv_img)

        step["tf_action"] = {"action": -1, "probability": -1}
        step["tf_results"] = []
        for i, r in enumerate(tf_result):
            step["tf_results"].append({"action": i, "probability": r})
            if r > step["tf_action"]["probability"]:
                step["tf_action"] = {"action": i, "probability": r}

        # Results
        step["results"] = []

        return step, cv_img, grad_img

    except Exception as e:
        print(e)


def analyze_bag(bag_path: str, metadata: ModelMetadata) -> Dict:
    """
    Analyzes a bag file and returns information about the bag.

    Args:
        bag_path (str): The path to the bag file.
        metadata (ModelMetadata): Metadata of the model.

    Returns:
        Dict: A dictionary containing information about the bag file, including start time, FPS, total frames, step difference, elapsed time, action space size, and image shape.
    """

    bag_info = {}

    reader = utils.get_reader(bag_path, topics=["/inference_pkg/rl_results"])

    first_stamp: float = -1
    steps_data = {"steps": []}

    s = 0

    while reader.has_next() and s < 60:
        step = {}

        (_, data, _) = reader.read_next()
        msg = deserialize_message(data, InferResultsArray)

        # Timestamp
        timestamp: float = (
            msg.images[0].header.stamp.sec + msg.images[0].header.stamp.nanosec / 1e9
        )

        if s == 0:
            first_stamp = timestamp

        step["timestamp"] = timestamp - first_stamp
        step["seq"] = s  # int(msg.images[0].header.frame_id)
        steps_data["steps"].append(step)

        s += 1

    while reader.has_next():
        (_, _, _) = reader.read_next()
        s += 1

    df = pd.json_normalize(steps_data["steps"])
    del steps_data

    step_diff = df["seq"].max() - df["seq"].min()
    tmp_img = bridge.compressed_imgmsg_to_cv2(
        msg.images[0], desired_encoding="passthrough"
    )

    bag_info["name"] = os.path.basename(bag_path)
    bag_info["start_time"] = first_stamp
    bag_info["fps"] = step_diff / df["timestamp"].max()
    bag_info["total_frames"] = s
    bag_info["step_diff"] = step_diff + 1
    bag_info["step_actual"] = len(df.index)
    bag_info["elapsed_time"] = df["timestamp"].max()
    bag_info["image_shape"] = tmp_img.shape
    if metadata.action_space_type == "discrete":
        bag_info["action_space_size"] = len(msg.results)
        bag_info["action_space"] = metadata.action_space.action_space
        bag_info["flip_x"] = metadata.action_space.action_space[0]["steering_angle"] < 0

    return bag_info


def process_file(
    bag_path: str,
    model_bytes: bytes,
    metadata: ModelMetadata,
    args: argparse.Namespace,
    frame_limit: int,
) -> Dict:
    """
    Processes a bag file and generates a video with the processed frames.

    Args:
        bag_path (str): Path to the bag file.
        model_bytes (bytes): Model data in bytes.
        metadata (ModelMetadata): Metadata of the model.
        args (argparse.Namespace): Command-line arguments.
        frame_limit (int): Maximum number of frames to process.

    Returns:
        Dict: A dictionary containing steps data, bag information, action names, and the output file path.
    """

    # Prepare action names
    action_names = []
    if metadata.action_space_type == "discrete":
        action_space = metadata.action_space.action_space
        max_steering_angle = max(
            float(action["steering_angle"]) for action in action_space
        )
        max_speed = max(float(action["speed"]) for action in action_space)

        for action in action_space:
            if args.relative_labels:
                if float(action["steering_angle"]) == 0.0:
                    steering_label = "C"
                else:
                    steering_label = "L" if float(action["steering_angle"]) > 0 else "R"
                steering_value = abs(
                    float(action["steering_angle"]) * 100 / max_steering_angle
                )
                speed_value = float(action["speed"]) * 100 / max_speed
                action_names.append(
                    f"{steering_label}{steering_value:.0f}% x {speed_value:.0f}%"
                )
            else:
                action_names.append(
                    str(action["steering_angle"])
                    + "\N{DEGREE SIGN}"
                    + " "
                    + "%.1f" % action["speed"]
                )

    bag_info = analyze_bag(bag_path, metadata)
    utils.print_baginfo(bag_info)

    # Key data points
    worker_count = int((psutil.cpu_count(logical=False)) * 3 / 4)
    frame_limit = int(min(bag_info["total_frames"], frame_limit))

    print("")
    print(
        "Analysed file. Starting processing of {} frames with {} workers.".format(
            frame_limit, worker_count
        )
    )

    if args.background:
        background_path = os.path.join(
            SCRIPT_DIR,
            "resources",
            "AWS-Deepracer_Background_Machine-Learning.928f7bc20a014c7c7823e819ce4c2a84af17597c.jpg",
        )
        background = utils.load_background_image(background_path, WIDTH, HEIGHT)
    else:
        background = None

    # Create video writer
    if args.output_file:
        output_file = args.output_file
        if not os.path.exists(os.path.dirname(output_file)):
            print(f"Output directory '{os.path.dirname(output_file)}' does not exist.")
            exit(1)
    else:
        output_file = "{}.mp4".format(bag_path)

    print("Creating video file: {}".format(output_file))

    CODEC = args.codec
    writer = cv2.VideoWriter(
        output_file,
        cv2.VideoWriter_fourcc(*CODEC),
        int(round(bag_info["fps"], 0)),
        (WIDTH, HEIGHT),
    )

    steps_data = {"steps": []}

    try:
        # Create queues for data, results, and errors
        data_queue = mp.Queue()
        error_queue = mp.Queue()  # Add error queue
        manager = mp.Manager()
        result_list = manager.list()
        list_lock = manager.Lock()

        # Use a separate process to read from the stream
        stream_reader = mp.Process(
            target=utils.read_stream,
            args=(data_queue, bag_path, ["/inference_pkg/rl_results"], frame_limit),
        )
        procs.append(stream_reader)
        stream_reader.start()

        # Create worker processes with error queue
        for _ in range(worker_count):
            p = mp.Process(
                target=process_worker,
                args=(
                    data_queue,
                    (result_list, list_lock),
                    model_bytes,
                    metadata,
                    bag_info,
                    background,
                    action_names,
                    error_queue,  # Pass error queue
                ),
            )
            p.start()
            procs.append(p)

        pbar_proc = tqdm(
            total=frame_limit,
            desc="Processing messages",
            unit="msgs",
            smoothing=0.1,
            leave=True,
            mininterval=args.update_frequency,
        )
        pbar_write = tqdm(
            total=min(bag_info["total_frames"], frame_limit),
            desc="Writing image frames",
            unit="frames",
            smoothing=0.1,
            leave=True,
            mininterval=args.update_frequency,
        )

        # Priority queue to store results
        pq = []
        expected_index = 1
        received = 0
        error_count = 0
        max_errors = 5  # Set a threshold for maximum errors

        while True:
            try:
                # Check for errors from workers
                try:
                    while not error_queue.empty():
                        error_type, error_msg = error_queue.get_nowait()
                        print(f"Worker error ({error_type}): {error_msg}")
                        error_count += 1

                        if error_type == "worker_error":
                            # Critical worker error - might need to restart or abort
                            print("Critical worker error detected!")

                        if error_count > max_errors:
                            raise Exception(
                                f"Too many worker errors ({error_count}), aborting"
                            )

                except queue.Empty:
                    pass

                # Check if any worker processes died unexpectedly
                dead_workers = [
                    p for p in procs[1:] if not p.is_alive() and p.exitcode != 0
                ]
                if dead_workers:
                    print(
                        f"Warning: {len(dead_workers)} worker process(es) died unexpectedly"
                    )
                    for worker in dead_workers:
                        print(f"Worker PID {worker.pid} exit code: {worker.exitcode}")

                while len(result_list) > 0:
                    with list_lock:
                        result = result_list.pop(0)

                    heapq.heappush(pq, result)
                    received += 1
                    pbar_proc.update(1)

                    if received == frame_limit:
                        pbar_proc.refresh()

                # Process results in order
                if pq and pq[0][0] == expected_index:
                    _, step, encimg = heapq.heappop(pq)
                    steps_data["steps"].append(step)
                    writer.write(
                        cv2.imdecode(
                            np.frombuffer(encimg, dtype=np.uint8), cv2.IMREAD_COLOR
                        )
                    )
                    pbar_write.update(1)
                    expected_index += 1

                if len(steps_data["steps"]) == frame_limit:
                    pbar_write.refresh()
                    pbar_proc.close()
                    pbar_write.close()
                    break

            except Exception as e:
                print(f"Error in main processing loop: {e}")
                raise

        # Wait for the stream reader to finish, then send termination
        # to the worker processes.
        stream_reader.join()
        procs.pop(0)
        for _ in range(worker_count):
            data_queue.put(None)

    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

    finally:
        # Enhanced cleanup
        try:
            writer.release()
        except:
            pass

        # Terminate all processes gracefully
        for p in procs:
            if p.is_alive():
                p.terminate()
            try:
                p.join(timeout=5)  # Wait up to 5 seconds
            except:
                pass

            # Force kill if still alive
            if p.is_alive():
                p.kill()
                p.join()

    return steps_data, bag_info, action_names, output_file


def main():
    """
    Analyzes a rosbag file and generates a video with annotated frames.

    This function takes command line arguments for the codec, rosbag file path, and model directory path.
    It performs the following steps:
    1. Checks if the model directory exists.
    2. Checks if the model metadata file and model file exist.
    3. Checks if the rosbag file exists.
    4. Loads the model metadata and extracts action names.
    5. Analyzes the rosbag file to get information about the frames.
    6. Creates a video writer with the specified codec and frame rate.
    7. Processes the data from the rosbag file, applies Grad-CAM, and creates annotated frames.
    8. Writes the annotated frames to the video file.
    9. Releases the video writer.
    10. Performs analysis on the recorded steps and prints the results.

    Args:
        None

    Returns:
        None
    """
    # Set logging level for rosbag2_storage to WARN to suppress info messages
    rclpy.logging.set_logger_level(
        "rosbag2_storage", rclpy.logging.LoggingSeverity.WARN
    )

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--codec", help="The codec for the video writer", default="avc1"
    )
    parser.add_argument("--bag_path", help="The path to the rosbag file", required=True)
    parser.add_argument(
        "--model", help="The path to the model directory or tar.gz-file", required=True
    )
    parser.add_argument(
        "--frame_limit", help="Max number of frames to process", default=None
    )
    parser.add_argument("--describe", help="Describe the actions", default=False)
    parser.add_argument(
        "--relative_labels",
        help="Make labels relative, not fixed to value in action space",
        default=False,
        action="store_true",
    )
    parser.add_argument(
        "--background",
        help="Add a background to the video",
        default=False,
        action="store_true",
    )
    parser.add_argument(
        "--update_frequency",
        help="Update frequency for the progress bar",
        default=1.0,
        type=float,
    )
    parser.add_argument(
        "--output_file", help="The path to the output video file", default=None
    )

    args = parser.parse_args()

    if os.path.isdir(args.model):
        metadata, model_bytes = utils.load_model_from_dir(args.model)
        print("Using model directory: {}".format(args.model))
    elif args.model.endswith(".tar.gz") or args.model.endswith(".tgz"):
        metadata, model_bytes = utils.load_model_from_tar(args.model)
        print("Using model archive: {}".format(args.model))
    else:
        raise ValueError("Model path must be a directory or a tar.gz/tgz file")

    bag_path = args.bag_path.rstrip("/")
    if not os.path.exists(bag_path):
        raise FileNotFoundError(f"Bag directory '{bag_path}' does not exist.")
    else:
        print(f"Processing bag file: {bag_path}")

    if args.frame_limit:
        frame_limit = float(args.frame_limit)
    else:
        frame_limit = float("inf")

    ### Main Processing Step ###
    steps_data, bag_info, action_names, output_file = process_file(
        bag_path, model_bytes, metadata, args, frame_limit
    )

    # Print analysis
    df = pd.json_normalize(steps_data["steps"])
    del steps_data

    step_diff = df["seq"].max() - df["seq"].min()
    fps = step_diff / df["timestamp"].max()
    print("")
    print(
        "Start time: {}".format(datetime.datetime.fromtimestamp(bag_info["start_time"]))
    )
    print("Loaded {} steps from {}.".format(len(df.index), step_diff + 1))
    print("Duration: {:.2f} seconds".format(df["timestamp"].max()))
    print("Average FPS: {:.1f}".format(fps))
    print("Action Space: {} actions".format(len(action_names)))

    df["action_agree"] = np.where(
        df["car_action.action"] == df["tf_action.action"], 1, 0
    )
    print(
        "Car inference vs. Tensorflow: {} of {} in agreement".format(
            df["action_agree"].sum(), len(df.index)
        )
    )

    if args.describe:
        df["action_diff"] = np.abs(df["car_action.action"] - df["tf_action.action"])
        action_analysis = df[
            [
                "timestamp",
                "seq",
                "car_action.action",
                "tf_action.action",
                "car_action.probability",
                "tf_action.probability",
                "action_agree",
                "action_diff",
            ]
        ]
        print(action_analysis.describe())

    print("Created video file: {}".format(output_file))


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)

    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # or any {'0', '1', '2'}
    import tensorflow as tf  # type: ignore

    tf.compat.v1.logging.set_verbosity(tf.compat.v1.logging.ERROR)
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        exit(1)
