import os
os.environ.setdefault("APPSYNC_ENDPOINT", "https://example.appsync-api.eu-west-1.amazonaws.com/graphql")
os.environ.setdefault("APPSYNC_REGION", "eu-west-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "AKIA_TEST")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "SECRET_TEST")

from unittest.mock import patch, MagicMock

from appsync_iam import send_mutation


def test_send_mutation_raises_on_graphql_errors():
    import pytest
    fake_response = MagicMock()
    fake_response.json.return_value = {"errors": [{"message": "boom"}]}
    fake_response.status_code = 200
    with patch("appsync_iam.requests.post", return_value=fake_response):
        with pytest.raises(RuntimeError, match="boom"):
            send_mutation("mutation { x }", {"a": 1})


def test_send_mutation_returns_data_on_success():
    fake_response = MagicMock()
    fake_response.json.return_value = {"data": {"updatePdfJob": {"jobId": "j-1"}}}
    fake_response.status_code = 200
    with patch("appsync_iam.requests.post", return_value=fake_response):
        result = send_mutation("mutation { x }", {"a": 1})
    assert result == {"updatePdfJob": {"jobId": "j-1"}}
