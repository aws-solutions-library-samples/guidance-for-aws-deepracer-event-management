#!/usr/bin/env python3

import datetime
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


def create_title_frame(
    width: int,
    height: int,
    username: str,
    models: list,
    car_name: str = None,
    event_name: str = None,
    background_path: str = None,
    logo_path: str = None,
    fonts: dict = None,
) -> np.ndarray:
    """
    Create a title frame to display at the start of a combined video.

    Args:
        width (int): The width of the frame.
        height (int): The height of the frame.
        username (str): The username to display on the first line.
        models (list): List of models used in the video, each with modelName.
        car_name (str, optional): The name of the car. Defaults to None.
        event_name (str, optional): The name of the event. Defaults to None.
        background_path (str): The path to the background image.
        logo_path (str): The path to the logo image.
        fonts (dict): A dict with paths to the fonts.

    Returns:
        np.ndarray: The created title frame.
    """
    background = cv2.imread(background_path)
    background = cv2.resize(background, (width, height))

    # Convert the background to a PIL image
    background_pil = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(background_pil)

    # Add logo to the top left corner if provided
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            
            # Resize logo to appropriate size (height of about 10% of the frame)
            logo_height = int(height * 0.1)  # 10% of frame height
            logo_width = int(logo.width * (logo_height / logo.height))
            logo = logo.resize((logo_width, logo_height), Image.LANCZOS)
            
            # Position logo in the top left with some padding
            padding = 20
            logo_position = (padding, padding)
            
            # Create a new image with alpha channel for proper transparency
            if logo.mode == 'RGBA':
                # Create a new RGB image with white background for PIL to handle transparency
                temp_img = Image.new('RGBA', background_pil.size, (0, 0, 0, 0))
                temp_img.paste(logo, logo_position)
                
                # Composite the images
                background_pil = Image.alpha_composite(
                    background_pil.convert('RGBA'), 
                    temp_img
                ).convert('RGB')
            else:
                # If no transparency, just paste directly
                background_pil.paste(logo, logo_position, logo)
            
            # Recreate the draw object after modifying the image
            draw = ImageDraw.Draw(background_pil)
            
        except Exception as e:
            print(f"Error adding logo: {e}")

    # Load custom fonts
    font_bd_50 = ImageFont.truetype(fonts["bold"], 50)  # Title font
    font_he_80 = ImageFont.truetype(fonts["heavy"], 80)  # Larger for racer name
    font_he_45 = ImageFont.truetype(fonts["heavy"], 45)  # Headers (Models)
    font_he_38 = ImageFont.truetype(fonts["heavy"], 38)  # Bold labels for footer
    font_rg = ImageFont.truetype(fonts["regular"], 40)  # Regular text
    font_sm = ImageFont.truetype(fonts["regular"], 38)  # Smaller text for models and footer

    vertical_start = height // 7  # Start slightly higher for better balance
    line_spacing = 90  # Increased spacing for the larger racer name
    
    # Draw the title - use event name if provided, otherwise use default
    title_text = event_name if event_name else "AWS DeepRacer Session"
    text_bbox_title = draw.textbbox((0, 0), title_text, font=font_bd_50)
    text_x_title = (width - (text_bbox_title[2] - text_bbox_title[0])) // 2
    
    # Draw the title
    draw.text(
        (text_x_title, vertical_start), 
        title_text, 
        font=font_bd_50, 
        fill=(255, 255, 255)
    )
    
    # Draw username (larger, centered)
    text_bbox_username = draw.textbbox((0, 0), username, font=font_he_80)
    text_x_username = (width - (text_bbox_username[2] - text_bbox_username[0])) // 2
    draw.text(
        (text_x_username, vertical_start + line_spacing), 
        username, 
        font=font_he_80, 
        fill=(255, 255, 255)
    )
    
    # Models header - centered in the main content area
    models_start_y = vertical_start + line_spacing * 2 + 30
    
    # Draw 'Models' or 'Model' label centered
    models_title = "Model" if len(models) == 1 else "Models"
    text_bbox_models_title = draw.textbbox((0, 0), models_title, font=font_he_45)
    text_x_models_title = (width - (text_bbox_models_title[2] - text_bbox_models_title[0])) // 2
    draw.text(
        (text_x_models_title, models_start_y), 
        models_title, 
        font=font_he_45, 
        fill=(255, 255, 255)
    )
    
    # List each model used, centered
    model_y = models_start_y + 60
    for model in models:
        model_text = model.get("modelName", "Unknown model")
        text_bbox_model = draw.textbbox((0, 0), model_text, font=font_sm)
        text_x_model = (width - (text_bbox_model[2] - text_bbox_model[0])) // 2
        draw.text(
            (text_x_model, model_y), 
            model_text, 
            font=font_sm, 
            fill=(255, 255, 255)
        )
        model_y += 45  # Slightly more space between model names
    
    # Footer area with Car and Created date
    footer_y = height - 100
    
    # Draw date on the right side - using bold for "Created" and regular for the date
    current_date = datetime.datetime.now().strftime('%Y-%m-%d')
    
    # First, draw the "Created" label in bold
    created_label = "Created"
    text_bbox_created = draw.textbbox((0, 0), created_label, font=font_he_38)
    
    # Then calculate the date width
    date_text = current_date
    text_bbox_date = draw.textbbox((0, 0), date_text, font=font_sm)
    
    # Calculate total width of the combined text for centering in the right half
    total_width = (text_bbox_created[2] - text_bbox_created[0]) + 10 + (text_bbox_date[2] - text_bbox_date[0])
    right_center_x = (width // 4) * 3
    start_x = right_center_x - (total_width // 2)
    
    # Draw the label
    draw.text(
        (start_x, footer_y), 
        created_label, 
        font=font_he_38, 
        fill=(255, 255, 255)
    )
    
    # Draw the date (with a space after "Created")
    draw.text(
        (start_x + (text_bbox_created[2] - text_bbox_created[0]) + 10, footer_y), 
        date_text, 
        font=font_sm, 
        fill=(255, 255, 255)
    )
    
    # Draw car info on the left side if provided - using bold for "Car" and regular for car name
    if car_name:
        # First, calculate the "Car" label width
        car_label = "Car"
        text_bbox_car_label = draw.textbbox((0, 0), car_label, font=font_he_38)
        
        # Then calculate the car name width
        car_name_text = car_name
        text_bbox_car_name = draw.textbbox((0, 0), car_name_text, font=font_sm)
        
        # Calculate total width for centering in left half
        total_width = (text_bbox_car_label[2] - text_bbox_car_label[0]) + 10 + (text_bbox_car_name[2] - text_bbox_car_name[0])
        left_center_x = width // 4
        start_x = left_center_x - (total_width // 2)
        
        # Draw the "Car" label in bold
        draw.text(
            (start_x, footer_y), 
            car_label, 
            font=font_he_38, 
            fill=(255, 255, 255)
        )
        
        # Draw the car name (with a space after "Car")
        draw.text(
            (start_x + (text_bbox_car_label[2] - text_bbox_car_label[0]) + 10, footer_y), 
            car_name_text, 
            font=font_sm, 
            fill=(255, 255, 255)
        )

    # Convert the PIL image back to a NumPy array
    background = cv2.cvtColor(np.array(background_pil), cv2.COLOR_RGB2BGR)

    return background


def combine_videos(
    video_files: list,
    output_file: str,
    image_assets: dict,
    fonts: dict,
    codec: str = "avc1",
    skip_duration: float = 20.0,
    update_frequency: float = 0.1,
    metadata: dict = None,
) -> dict:
    """
    Combine multiple video files into a single video file.

    Args:
        video_files (list): A list of video file paths to combine.
        output_file (str): The path to the output video file.
        image_assets (dict): A dict with paths to the background image and logo.
        fonts (dict): A dict with paths to the fonts.
        codec (str): The codec for the video writer.
        skip_duration (float): Skip video files with duration less than the specified value.
        update_frequency (float): Update frequency for the progress bar.
        metadata (dict): Additional race data including username, models, car_name, and event_name.

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
    
    # Add title frame at the beginning (if race_data is provided)
    title_duration = 3.0  # Show title frame for 3 seconds
    if metadata and metadata.get('username') and metadata.get('models'):
        title_frame = create_title_frame(
            width,
            height,
            metadata.get('username'),
            metadata.get('models'),
            car_name=metadata.get('car_name'),
            event_name=metadata.get('event_name'),
            background_path=image_assets["background"],
            logo_path=image_assets["logo"],
            fonts=fonts
        )
        
        for _ in range(int(fps * title_duration)):
            out.write(title_frame)
        
        total_duration += title_duration

    divider_duration = 1.5  # Duration of the divider frame in seconds

    # Rest of the function remains unchanged
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
            image_assets["background"],
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
