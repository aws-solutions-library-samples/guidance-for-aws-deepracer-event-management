import os
from datetime import date, datetime

import http_response
import pytest

BUCKET_NAME = "test-bucket"


@pytest.fixture(autouse=True)
def mock_os_env():
    os.environ["bucket"] = BUCKET_NAME

    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"


def test_response_no_message():
    response = http_response.response(200)
    assert response["body"] == "null"


def test_response_string_message():
    response = http_response.response(200, "test")
    assert response["body"] == '"test"'


def test_response_name_error_exception_message():
    try:
        raise NameError("exception message")
    except NameError as e:
        response = http_response.response(500, e)
        assert response["body"] == '{"error_message": "exception message"}'


def test_response_exception_message():
    try:
        raise Exception("exception message")
    except Exception as e:
        response = http_response.response(500, e)
        assert response["body"] == '{"error_message": "exception message"}'


def test_response_error_code_200():
    response = http_response.response(200)
    assert response["statusCode"] == 200


def test_response_error_code_500():
    response = http_response.response(500)
    assert response["statusCode"] == 500


def test_json_serial_datettime():
    now = datetime.now()
    assert type(http_response.json_serial(now)) is str


def test_json_serial_date():
    _date = date.fromtimestamp(1656493067)
    assert type(http_response.json_serial(_date)) is str
