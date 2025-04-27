#!/usr/bin/env python3

import os
import random
import string
from enum import Enum

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from tqdm import tqdm


class VideoGroupingMode(Enum):
    USER_MODEL_DATE = 1
    USER_MODEL = 2
    USER_RACE = 3

def unique_suffix(length: int = 4) -> str:
    """
    Generate a unique suffix for filenames.

    Args:
        length (int): Length of the unique suffix. Defaults to 4.

    Returns:
        str: A unique suffix string.
    """
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


def organize_videos(
    user_model_videos: list,
    car_name: str = None,
    video_grouping_mode: VideoGroupingMode = VideoGroupingMode.USER_MODEL_DATE,
) -> list:
    """
    Organize videos based on the specified grouping mode.

    Args:
        user_model_videos (list): A list of dictionaries with user info, models, and videos.
        car_name (str, optional): The name of the car. Defaults to None.
        video_grouping_mode (VideoGroupingMode): The mode to group videos.

    Returns:
        list: A list of videos to create, with format:
        [
            {
                "sub": user_id,
                "username": username,
                "username_normalized": username_normalized,
                "output_file": filename,
                "model_name": model_name,      # Only for USER_MODEL_DATE and USER_MODEL modes
                "date": date,                  # Only for USER_MODEL_DATE mode
                "source_videos": [list of video files sorted by timestamp]
            }
        ]
    """
    
    organized_videos = []
    
    # Process each user
    for user in user_model_videos:
        user_id = user["sub"]
        username = user.get("username", user_id)
        username_normalized = user.get("username_normalized", user_id)
        
        match video_grouping_mode:
            case VideoGroupingMode.USER_MODEL_DATE:
                # Group by user, model, and date
                for model in user["models"]:
                    model_name = model["modelname"]
                    model_id = model["modelId"]
                    
                    # Group videos by date
                    videos_by_date = {}
                    for video in model["videos"]:
                        # Extract date from timestamp (format: YYYYMMDD-HHMMSS)
                        date = video["timestamp"][:8]  # First 8 chars (YYYYMMDD)
                        if date not in videos_by_date:
                            videos_by_date[date] = []
                        videos_by_date[date].append({
                            "file": video["file"], 
                            "timestamp": video["timestamp"]
                        })
                    
                    # Create a video output for each date
                    for date, video_files in videos_by_date.items():
                        # Sort videos by timestamp
                        video_files.sort(key=lambda x: x["timestamp"])
                        sorted_files = [v["file"] for v in video_files]
                        
                        # Build file name components
                        name_parts = [username_normalized, model_name]
                        if car_name:
                            name_parts.append(car_name.strip())
                        name_parts.append(date)
                        name_parts.append(unique_suffix())
                        
                        output_filename = "_".join(name_parts) + ".mp4"
                        
                        organized_videos.append({
                            "sub": user_id,
                            "username": username,
                            "username_normalized": username_normalized,
                            "output_file": output_filename,
                            "models": [{"modelId": model_id, "modelName": model_name}],
                            "date": date,
                            "source_videos": sorted_files
                        })
            
            case VideoGroupingMode.USER_MODEL:
                # Group by user and model only
                for model in user["models"]:
                    model_name = model["modelname"]
                    model_id = model["modelId"]
                    
                    # Collect videos with timestamps
                    video_files_with_timestamps = [
                        {"file": video["file"], "timestamp": video["timestamp"]}
                        for video in model["videos"]
                    ]
                    
                    # Sort videos by timestamp
                    video_files_with_timestamps.sort(key=lambda x: x["timestamp"])
                    sorted_files = [v["file"] for v in video_files_with_timestamps]
                    
                    if sorted_files:                      
                        # Build file name components
                        name_parts = [username_normalized, model_name]
                        if car_name:
                            name_parts.append(car_name.strip())
                        name_parts.append(unique_suffix())
                        
                        output_filename = "_".join(name_parts) + ".mp4"
                        
                        organized_videos.append({
                            "sub": user_id,
                            "username": username,
                            "username_normalized": username_normalized,                            
                            "output_file": output_filename,
                            "models": [{"modelId": model_id, "modelName": model_name}],
                            "source_videos": sorted_files
                        })
            
            case VideoGroupingMode.USER_RACE:
                # Group all videos by user only
                video_files_with_timestamps = []
                models_set = []  # Collect unique models
                
                # Collect all videos with timestamps and track all models
                for model in user["models"]:
                    model_id = model["modelId"]
                    model_name = model["modelname"]
                    
                    # Add model to the set if it has videos
                    if model["videos"]:
                        models_set.append({
                            "modelId": model_id, 
                            "modelName": model_name
                        })
                    
                    for video in model["videos"]:
                        video_files_with_timestamps.append({
                            "file": video["file"],
                            "timestamp": video["timestamp"]
                        })
                
                # Sort all videos by timestamp
                video_files_with_timestamps.sort(key=lambda x: x["timestamp"])
                sorted_files = [v["file"] for v in video_files_with_timestamps]
                
                if sorted_files:                   
                    # Get the first timestamp from the sorted list
                    first_timestamp = video_files_with_timestamps[0]["timestamp"] if video_files_with_timestamps else "unknown"
                    
                    # Build file name components
                    name_parts = [username_normalized]
                    if car_name:
                        name_parts.append(car_name.strip())
                    name_parts.append(first_timestamp)  # Include the full timestamp
                    name_parts.append(unique_suffix())
                    
                    output_filename = "_".join(name_parts) + ".mp4"
                    
                    organized_videos.append({
                        "sub": user_id,
                        "username": username,
                        "username_normalized": username_normalized,                        
                        "output_file": output_filename,
                        "models": models_set,  # Add the array of models
                        "source_videos": sorted_files
                    })
    
    return organized_videos

def create_divider_frame(
    width: int,
    height: int,
    prefix: str,
    date_time: str,
    background_path: str,
    fonts: dict,
) -> np.ndarray:
    """
    Create a divider frame with the specified text and background.

    Args:
        width (int): The width of the frame.
        height (int): The height of the frame.
        prefix (str): The prefix to display on the first line.
        date_time (str): The date and time to display on the second line.
        background_path (str): The path to the background image.
        fonts (dict): A dict with paths to the fonts.

    Returns:
        np.ndarray: The created divider frame.
    """
    background = cv2.imread(background_path)
    background = cv2.resize(background, (width, height))

    # Convert the background to a PIL image
    background_pil = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(background_pil)

    # Load custom fonts
    font_bd = ImageFont.truetype(fonts["bold"], 60)
    font_rg = ImageFont.truetype(fonts["regular"], 45)

    # Calculate text positions using textbbox
    text_bbox_prefix = draw.textbbox((0, 0), prefix, font=font_bd)
    text_x_prefix = (width - (text_bbox_prefix[2] - text_bbox_prefix[0])) // 2
    text_y_prefix = (height // 2) - 60

    # Format the date_time as YYYY-MM-DD HH:MM:ss
    date_time_formatted = f"{date_time[:4]}-{date_time[4:6]}-{date_time[6:8]} {date_time[9:11]}:{date_time[11:13]}:{date_time[13:15]}"

    text_bbox_date_time = draw.textbbox((0, 0), date_time_formatted, font=font_rg)
    text_x_date_time = (width - (text_bbox_date_time[2] - text_bbox_date_time[0])) // 2
    text_y_date_time = (height // 2) + 20

    # Put text on the background
    draw.text(
        (text_x_prefix, text_y_prefix), prefix, font=font_bd, fill=(255, 255, 255)
    )
    draw.text(
        (text_x_date_time, text_y_date_time),
        date_time_formatted,
        font=font_rg,
        fill=(255, 255, 255),
    )

    # Convert the PIL image back to a NumPy array
    background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)

    return background


def combine_videos(
    video_files: list,
    output_file: str,
    background_path: str,
    fonts: dict,
    codec: str = "avc1",
    skip_duration: float = 20.0,
    update_frequency: float = 0.1,
    race_data: dict = None,
) -> dict:
    """
    Combine multiple video files into a single video file.

    Args:
        video_files (list): A list of video file paths to combine.
        output_file (str): The path to the output video file.
        background_path (str): The path to the background image for dividers.
        fonts (dict): A dict with paths to the fonts.
        codec (str): The codec for the video writer.
        skip_duration (float): Skip video files with duration less than the specified value.
        update_frequency (float): Update frequency for the progress bar.

    Returns:
        dict: Information about the combined video file.
    """
    if not video_files:
        print("No video files to combine.")
        return {}

    print(f"Starting new video file: {output_file}")

    # Get the properties of the first video
    cap = cv2.VideoCapture(video_files[0])
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()

    # Create a video writer
    fourcc = cv2.VideoWriter_fourcc(*codec)
    out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

    total_duration = 0

    divider_duration = 1.5  # Duration of the divider frame in seconds

    for video_file in video_files:
        # Extract prefix and date_time from the filename
        parts = os.path.basename(video_file).split("-")
        prefix = "-".join(parts[:-2])
        date_time = "-".join(parts[-2:]).replace(".mp4", "")

        cap = cv2.VideoCapture(video_file)
        duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        if duration < skip_duration:
            print(f"Skipping {video_file} (duration: {duration:.2f} seconds)")
            cap.release()
            continue

        total_duration += duration

        # Create and write divider frame
        divider_frame = create_divider_frame(
            width,
            height,
            prefix,
            date_time,
            background_path,
            fonts
        )
        for _ in range(
            int(fps * divider_duration)
        ):  # Display the divider for 1.5 second
            out.write(divider_frame)

        total_duration += divider_duration

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        with tqdm(
            total=total_frames,
            desc=f"Processing {os.path.basename(video_file)}",
            unit="frames",
            mininterval=update_frequency,
        ) as pbar:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                out.write(frame)
                pbar.update(1)
        cap.release()

    out.release()
    print(f"Finished video file: {output_file}")

    return {
        "output_file": output_file,
        "resolution": f"{width}x{height}",
        "duration": total_duration,
        "codec": codec,
        "fps": fps,
    }
