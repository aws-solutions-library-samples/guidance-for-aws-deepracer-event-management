import gzip
import os
import shutil
import tarfile

from aws_lambda_powertools import Logger

logger = Logger()


def zip(full_source_name, target_directory):
    """Action function called for a file to zip the file and copy them from
        source path to target directory.

    Args:
        full_source_name (str): .gz file path.
        target_directory (str): Target directory path where these files will be copied.

    Returns:
        str: Full target path of the place where the unzipped files are copied.
    """
    filename = os.path.basename(full_source_name)
    full_target_name = f"{os.path.join(target_directory, filename)}.gz"
    logger.info(f"Zipping to {full_target_name}...")
    with open(full_source_name, "rb") as inFile:
        with gzip.open(full_target_name, "wb") as outFile:
            shutil.copyfileobj(inFile, outFile)

    return full_target_name


def unzip(full_source_name, target_directory, clean=False):
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
    logger.info(f"Unzipping to {target_directory}...")
    with gzip.open(full_source_name, "rb") as inFile:
        with open(full_target_name, "wb") as outFile:
            shutil.copyfileobj(inFile, outFile)
    return full_target_name


def tar(full_source_name, target_directory):
    """Action function called for a directory to tar the contents and copy into
      target directory.

    Args:
        full_source_name (str): directory file path.
        target_directory (str): Target directory path where the tar will be copied.

    Returns:
        str: Full target path of the place where the untarred files are copied.
    """

    mode = "w"
    suffix = "tar"

    filename = os.path.basename(full_source_name)
    full_target_name = f"{os.path.join(target_directory, filename)}.{suffix}"
    logger.info(f"Tarring to {full_target_name}...")
    with tarfile.TarFile(full_target_name, mode) as tarFile:
        tarFile.add(full_source_name, arcname="")
    return full_target_name


def untar(full_source_name, target_directory, clean=False):
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
    logger.info(f"Untarring to {target_directory}...")
    with tarfile.TarFile(full_source_name, "r") as srcFile:
        srcFile.extractall(target_directory)

    if clean:
        logger.info(f"Deleting {full_source_name}...")
        os.remove(full_source_name)

    return full_target_name


def extract_archive(filepath, target_directory, clean=False):
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
            filepath = action(filepath, target_directory, clean)

        return True

    except Exception as ex:
        logger.error(f"Failed to decompress {filepath}: {ex}")
        return False


def compress_archive(filepath, target_directory, suffix=".tar.gz"):
    """Helper function to recursively apply common compression activities.
        If the file contains multiple extensions(.tar.gz) then the tar is triggered
        first and then zip is triggered.

    Args:
        source (str): Path to the source directory.
        target_directory (str): Path where the target files are to be copied to.

    Returns:
        str: Filename if successful, otherwise None
    """
    try:
        supported_exts = {"gz": zip, "tar": tar}

        for s in suffix.split("."):
            if s not in supported_exts:
                continue

            action = supported_exts[s]
            filepath = action(filepath, target_directory)

        logger.info(f"Archive size {os.path.getsize(filepath)} bytes.")

        return filepath

    except Exception as ex:
        logger.error(f"Failed to compress {filepath}: {ex}")
        return None
