import os
import boto3
import json
from unittest import mock
from tempfile import NamedTemporaryFile
from moto import mock_s3
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
        
@pytest.fixture()
def s3_client(mock_os_env):
    with mock_s3():
        conn = boto3.client("s3", region_name="us-east-1")
        yield conn

def test_json_serial_datettime():
    from datetime import datetime
    from infrastructure.lambdas.get_models_function.index import json_serial
    now = datetime.now()
    assert type(json_serial(now)) is str

def test_json_serial_date():
    from datetime import date
    from infrastructure.lambdas.get_models_function.index import json_serial
    _date = date.fromtimestamp(1656493067)
    assert type(json_serial(_date)) is str

@mock_s3
def test_lambda_handler_file_found(s3_client):
    from infrastructure.lambdas.get_models_function.index import lambda_handler
    
    # We need to create the bucket since this is all in Moto's 'virtual' AWS account
    s3_client.create_bucket(Bucket=BUCKET_NAME)

    file_text = "test"
    with NamedTemporaryFile(delete=True, suffix=".txt") as tmp:
        with open(tmp.name, "w", encoding="UTF-8") as f:
            f.write(file_text)

        s3_client.upload_file(tmp.name, BUCKET_NAME, "private/file12")
        s3_client.upload_file(tmp.name, BUCKET_NAME, "private/file22")

    result = lambda_handler('Dummy Context', 'Dummy event')
    assert len(json.loads(result['body'])) == 2 #check that two files was returned

@mock_s3
def test_lambda_handler_file_found(s3_client):
    from infrastructure.lambdas.get_models_function.index import lambda_handler
    
    # We need to create the bucket since this is all in Moto's 'virtual' AWS account
    s3_client.create_bucket(Bucket=BUCKET_NAME)

    result = lambda_handler('Dummy Context', 'Dummy event')
    assert len(json.loads(result['body'])) == 0 #check that no files was returned