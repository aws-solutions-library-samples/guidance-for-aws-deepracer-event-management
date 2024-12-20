#!/usr/bin/env python3
import os
import sys
import subprocess
import argparse
import fnmatch

def usage():
    print("Usage: python bag_analysis_batch.py --input_dir <directory> --output_dir <directory> --models_dir <models_directory> [--codec <codec>] [--frame_limit <limit>] [--describe] [--relative_labels] [--background] [--pattern <pattern>]")
    sys.exit(1)

def main():
    """
    Main function to process bag files and generate videos.
    This function parses command-line arguments to get the input directory, output directory,
    models directory, codec, frame limit, and other options. It then processes each bag file
    in the input directory, runs analysis using the specified model, and generates videos.
    Finally, it combines all the generated videos into a single output.
    Command-line arguments:
        --input_dir (str): The directory containing the bag files (required).
        --output_dir (str): The directory to save the videos (required).
        --models_dir (str): The directory containing the model files (required).
        --codec (str): The codec for the video writer (default: "avc1").
        --frame_limit (int): Max number of frames to process (default: None).
        --describe (bool): Describe the actions (default: False).
        --relative_labels (bool): Make labels relative, not fixed to value in action space (default: False).
        --background (bool): Add a background to the video (default: True).
        --no-background (bool): Do not add a background to the video.
        --pattern (str): Pattern to filter bag files (default: "*").
        --skip_duration (float): Skip video files with duration less than the specified value (default: 20.0).
        --group_slice (str): Slice to allow videos to be grouped (default: ":-2").
    Exits with status 1 if any of the required directories do not exist.
    """

    script_dir = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser()
    parser.add_argument("--input_dir", help="The directory containing the bag files", required=True)
    parser.add_argument("--output_dir", help="The directory to save the videos", required=True)
    parser.add_argument("--models_dir", help="The directory containing the model files", required=True)
    parser.add_argument("--codec", help="The codec for the video writer", default="avc1")
    parser.add_argument("--frame_limit", help="Max number of frames to process", default=None)
    parser.add_argument("--describe", help="Describe the actions", action="store_true")
    parser.add_argument("--relative_labels", help="Make labels relative, not fixed to value in action space", default=False, action="store_true")
    parser.add_argument("--skip_duration", help="Skip video files with duration less than the specified value", type=float, default=20.0)
    parser.add_argument("--background", dest="background", help="Add a background to the video", action="store_true")
    parser.add_argument("--no-background", dest="background", help="Do not add a background to the video", action="store_false")
    parser.set_defaults(background=True)
    parser.add_argument("--pattern", help="Pattern to filter bag files", default="*")
    parser.add_argument("--group_slice", help="Slice to allow videos to be grouped", default=":-2")

    args = parser.parse_args()

    input_dir = args.input_dir
    output_dir = args.output_dir
    models_directory = args.models_dir

    if not os.path.isdir(input_dir):
        print(f"Directory {input_dir} does not exist.")
        sys.exit(1)

    if not os.path.isdir(output_dir):
        print(f"Directory {output_dir} does not exist.")
        sys.exit(1)

    if not os.path.isdir(models_directory):
        print(f"Models directory {models_directory} does not exist.")
        sys.exit(1)

    for file in os.listdir(input_dir):
        bag_path = os.path.join(input_dir, file)
        if fnmatch.fnmatch(file, args.pattern) and os.path.isdir(bag_path) and not os.path.commonpath([output_dir, bag_path]).startswith(output_dir):
            print("Trying to process", bag_path)
            
            model_name = '-'.join(file.split('-')[1:-2])
            model_path = os.path.join(models_directory, model_name)
            if not os.path.isdir(model_path):
                model_path = os.path.join(models_directory, model_name + '.tar.gz')
                if os.path.isfile(model_path):
                    pass
                else:
                    print(f"Model {model_name} does not exist in {models_directory}.")

            print(f"Running analysis for {bag_path}")
            cmd = [
                'python3', os.path.join(script_dir, 'bag_analysis.py'),
                '--bag_path', bag_path,
                '--model', model_path,
                '--codec', args.codec
            ]
            if args.relative_labels:
                cmd.extend(['--relative_labels'])
            if args.background:
                cmd.extend(['--background'])
            if args.frame_limit:
                cmd.extend(['--frame_limit', args.frame_limit])
            if args.describe:
                cmd.append('--describe')

            subprocess.run(cmd)

    print("\nFinished processing all bag files. Combining videos...\n")

    # After processing all bag files, combine the videos
    combine_videos_script = os.path.join(script_dir, 'combine_videos.py')
    cmd = [
        'python3', combine_videos_script,
        '--input_dir', input_dir,
        '--output_dir', output_dir,
        '--codec', args.codec,
        '--pattern', args.pattern,
        '--skip_duration', str(args.skip_duration),
        '--group_slice', args.group_slice
    ]
    subprocess.run(cmd)

if __name__ == "__main__":
    main()