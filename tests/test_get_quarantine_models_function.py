import json
import os
from tempfile import NamedTemporaryFile

import boto3
import pytest
from moto import mock_s3

BUCKET_NAME = "test-bucket"


@pytest.fixture(autouse=True)
def mock_os_env():
    os.environ["infected_bucket"] = BUCKET_NAME

    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"


@pytest.fixture()
def s3_client(mock_os_env):
    with mock_s3():
        conn = boto3.client("s3", region_name="us-east-1")
        yield conn


@mock_s3
def test_lambda_handler_file_found(s3_client):
    from backend.lambdas.get_models_function.index import lambda_handler

    # We need to create the bucket since this is all in Moto's 'virtual' AWS account
    s3_client.create_bucket(Bucket=BUCKET_NAME)

    file_text = "test"
    with NamedTemporaryFile(delete=True, suffix=".txt") as tmp:
        with open(tmp.name, "w", encoding="UTF-8") as f:
            f.write(file_text)

        s3_client.upload_file(tmp.name, BUCKET_NAME, "private/file12")
        s3_client.upload_file(tmp.name, BUCKET_NAME, "private/file22")

    result = lambda_handler("Dummy Context", "Dummy event")
    assert len(json.loads(result["body"])) == 2  # check that two files was returned


@mock_s3
def test_lambda_handler_file_not_found(s3_client):
    from backend.lambdas.get_models_function.index import lambda_handler

    # We need to create the bucket since this is all in Moto's 'virtual' AWS account
    s3_client.create_bucket(Bucket=BUCKET_NAME)

    result = lambda_handler("Dummy Context", "Dummy event")
    assert len(json.loads(result["body"])) == 0  # check that no files was returned
