import os
from unittest import mock
from moto import mock_s3
import pytest


@pytest.fixture(autouse=True)
def mock_settings_env_vars():
    with mock.patch.dict(os.environ, {"bucket": "testBucket"}):
        yield

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

