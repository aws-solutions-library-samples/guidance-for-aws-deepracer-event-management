import gzip
import os
import shutil
import tarfile

from aws_lambda_powertools import Logger

logger = Logger()


def unzip(full_source_name, target_directory):
    """Action function called for a .gz file to unzip the file and copy them from
        source path to target directory.

    Args:
        full_source_name (str): .gz file path.
        target_directory (str): Target directory path where these files will be copied.

    Returns:
        str: Full target path of the place where the unzipped files are copied.
    """
    filename = os.path.basename(full_source_name)
    full_target_name = os.path.splitext(os.path.join(target_directory, filename))[0]
    logger.info(f"    unzipping to {target_directory}...")
    with gzip.open(full_source_name, "rb") as inFile:
        with open(full_target_name, "wb") as outFile:
            shutil.copyfileobj(inFile, outFile)
    return full_target_name


def untar(full_source_name, target_directory):
    """Action function called for a .tar file to untar the file and copy them from
        source path to target directory.

    Args:
        full_source_name (str): .tar file path.
        target_directory (str): Target directory path where these files will be copied.

    Returns:
        str: Full target path of the place where the untarred files are copied.
    """
    filename = os.path.basename(full_source_name)
    full_target_name = os.path.splitext(os.path.join(target_directory, filename))[0]
    logger.info(f"    untarring to {target_directory}...")
    with tarfile.TarFile(full_source_name, "r") as srcFile:
        srcFile.extractall(target_directory)
    return full_target_name


def extract_archive(filepath, target_directory):
    """Helper function to recursively split the filename in the filepath and
        call the mapped action function for the extension found.
        If the file contains multiple extensions(.tar.gz) then the unzip is triggered
        first and then untar is triggered.

    Args:
        filepath (str): Path to the file that should be run through
                        action functions recursively.
        target_directory (str): Path where the target files are to be copied to.

    Returns:
        bool: True if successfully executed all actions else False.
    """
    try:
        supported_exts = {".gz": unzip, ".tar": untar}

        while True:
            ext = os.path.splitext(filepath)[1]
            if ext not in supported_exts:
                break
            action = supported_exts[ext]
            filepath = action(filepath, target_directory)

        return True

    except Exception as ex:
        logger.error(f"    failed to decompress {filepath}: {ex}")
        return False
