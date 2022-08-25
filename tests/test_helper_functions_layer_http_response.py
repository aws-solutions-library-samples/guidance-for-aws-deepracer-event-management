import os
import pytest

BUCKET_NAME = "test-bucket"

@pytest.fixture(autouse=True)
def mock_os_env():
    os.environ["bucket"] = BUCKET_NAME

    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = 'testing'
    os.environ["AWS_SECRET_ACCESS_KEY"] = 'testing'
    os.environ["AWS_SECURITY_TOKEN"] = 'testing'
    os.environ["AWS_SESSION_TOKEN"] = 'testing'
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"


def test_json_serial_datettime():
    from datetime import datetime
    from http_response import json_serial
    now = datetime.now()
    assert type(json_serial(now)) is str


def test_json_serial_date():
    from datetime import date
    from http_response import json_serial
    _date = date.fromtimestamp(1656493067)
    assert type(json_serial(_date)) is str
