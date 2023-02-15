import os
import uuid

import boto3
import http_response
import qrcode
import simplejson as json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from PIL import Image, ImageDraw, ImageFont

logger = Logger()

FONTCONFIG_PATH = "./fonts"
s3 = boto3.client("s3")
LABELS_S3_BUCKET = os.environ["LABELS_S3_BUCKET"]
URL_EXPIRY = os.environ["URL_EXPIRY"]


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> str:

    logger.debug(json.dumps(event))

    # TODO Check to see if we have details of this car already

    # Get the car values
    device_default_hostname = event["default_hostname"]
    device_default_pwd = event["default_password"]
    device_event_hostname = event["hostname"]
    device_event_password = event["password"]
    device_event_ipaddress = event["ip"]

    # Get the fonts
    fnt_small = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberRegular.TTF", 24)
    fnt_small_bold = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberBold.TTF", 24)
    fnt_large_bold = ImageFont.truetype(f"{FONTCONFIG_PATH}/AmazonEmberBold.TTF", 48)

    # Get the logo
    drlogobw = Image.open("./images/logo-bw.png")
    drlogobw.thumbnail((300, 300), Image.Resampling.LANCZOS)

    newimg = Image.new("RGB", (991, 306), color="white")
    drawer = ImageDraw.Draw(newimg)

    drawer.text((270, 10), device_event_hostname, font=fnt_large_bold, fill=(0, 0, 0))
    drawer.text((270, 240), device_event_ipaddress, font=fnt_large_bold, fill=(0, 0, 0))

    drawer.text(
        (270, 80),
        "Default Hostname: " + device_default_hostname,
        font=fnt_small,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 110),
        "Default Password: " + device_default_pwd,
        font=fnt_small,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 150),
        "Event Hostname: " + device_event_hostname,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 175),
        "Event Password: " + device_event_password,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    drawer.text(
        (270, 200),
        "Event IP Address: " + device_event_ipaddress,
        font=fnt_small_bold,
        fill=(0, 0, 0),
    )
    qrimg = qrcode.make(
        f"https://{device_event_ipaddress}?ddid={device_default_hostname}&dpwd={device_default_pwd}&epwd={device_event_password}&dremid={device_event_hostname}",  # noqa: E501
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
    newimg.paste(qrimg, (710, 75))
    newimg.paste(drlogobw, (-20, 0), mask=drlogobw)
    newimg = newimg.rotate(90, expand=True)

    # Create temp file (change to use hostname?)
    filename = uuid.uuid4()
    out_file = f"/tmp/{filename}.png"
    newimg.save(out_file)

    # Upload to S3
    try:
        key = f"car-label/{filename}.png"
        s3.upload_file(out_file, LABELS_S3_BUCKET, key)

        # TODO check response before generating url
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": LABELS_S3_BUCKET, "Key": key},
            ExpiresIn=URL_EXPIRY,
        )

        return http_response.response(
            200,
            {
                "url": presigned_url,
                "hostname": device_event_hostname,
                "ip": device_event_ipaddress,
            },
        )

    except Exception as error:
        logger.exception(error)
        return http_response.response(500, error)
