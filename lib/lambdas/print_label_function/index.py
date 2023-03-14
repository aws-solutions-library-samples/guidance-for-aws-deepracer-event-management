import json
import os
import uuid

import boto3
import http_response
import qrcode
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from PIL import Image, ImageDraw, ImageFont

logger = Logger()

# fonts
FONTCONFIG_PATH = "./fonts"

# S3
s3 = boto3.client("s3")
LABELS_S3_BUCKET = os.environ["LABELS_S3_BUCKET"]
URL_EXPIRY = os.environ["URL_EXPIRY"]

# car data url
CAR_STATUS_DATA_HANDLER_LAMBDA_NAME = os.environ["CAR_STATUS_DATA_HANDLER_LAMBDA_NAME"]

# lambda client
client = boto3.client("lambda")


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:
    logger.debug(event)
    logger.debug(context)

    instance_id = event["arguments"]["instanceId"]

    try:
        # Get the car values
        response = client.invoke(
            FunctionName=CAR_STATUS_DATA_HANDLER_LAMBDA_NAME,
            Payload=json.dumps({"instanceId": instance_id}),
        )

        bytes_response = response["Payload"].read()
        response = json.loads(json.loads(bytes_response))

        device_hostname = response.get("device_hostname", "Not defined")
        device_password = response.get("device_password", "Not defined")
        device_ipaddress = response.get("device_ipaddress", "Not defined")
    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)

    # create label
    label_img = create_label_image(
        device_ipaddress=device_ipaddress,
        device_hostname=device_hostname,
        device_password=device_password,
    )

    # Create temp file
    # hostname in filename makes it easier to find label in downloads folder
    filename = device_hostname + str(uuid.uuid4())[:8]
    out_file_path = f"/tmp/{filename}.png"
    label_img.save(out_file_path)

    # Upload to S3
    try:
        key = f"car-label/{filename}.png"
        s3.upload_file(out_file_path, LABELS_S3_BUCKET, key)

        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": LABELS_S3_BUCKET, "Key": key},
            ExpiresIn=URL_EXPIRY,
        )

        return presigned_url

    except Exception as error:
        logger.exception(error)
        return error


def create_label_image(device_ipaddress, device_hostname, device_password):
    # Get the fonts
    # fnt_small = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberRegular.TTF", 24)
    fnt_small_bold = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberBold.TTF", 24)
    fnt_large_bold = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberBold.TTF", 48)
    # Get the logo

    # get the data
    qr_hostname = (
        device_hostname + ".local"
    )  # .local as for DNS in local network, ask @marbuss
    qr_password = "" if device_password == "Not defined" else device_password

    dr_logo_bw = Image.open("./images/logo-bw.png")
    dr_logo_bw.thumbnail((300, 300), Image.Resampling.LANCZOS)
    new_img = Image.new("RGB", (991, 306), color="white")
    drawer = ImageDraw.Draw(new_img)
    drawer.text((270, 10), device_hostname, font=fnt_large_bold, fill=(0, 0, 0))
    drawer.text((270, 240), device_ipaddress, font=fnt_large_bold, fill=(0, 0, 0))
    drawer.text(
        (270, 150),
        "Hostname: " + device_hostname,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 175),
        "Password: " + device_password,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 200),
        "IP Address: " + device_ipaddress,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    qr_img = qrcode.make(
        f"https://{qr_hostname}?epwd={qr_password}",
        box_size=6,
        border=0,
    )
    drawer.text(
        (670, 10),
        "Scan QR Code with Racing",
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    drawer.text(
        (670, 40),
        "Tablet to access Vehicle UI",
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    new_img.paste(qr_img, (710, 75))
    new_img.paste(dr_logo_bw, (-20, 0), mask=dr_logo_bw)
    new_img = new_img.rotate(90, expand=True)
    return new_img
