import os
os.environ.setdefault("AWS_DEFAULT_REGION", "eu-west-1")
import sys, importlib
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))

# appsync_helpers lives in a Lambda layer; stub it so index.py can be imported in tests
_appsync_stub = MagicMock()
sys.modules.setdefault("appsync_helpers", _appsync_stub)
# aws_lambda_powertools stubs (may not be installed in venv).
# Make Logger/Tracer decorators pass-through so lambda_handler body is reachable.
_passthrough = lambda fn: fn  # noqa: E731
_logger_mock = MagicMock()
_logger_mock.return_value.inject_lambda_context.side_effect = _passthrough
_tracer_mock = MagicMock()
_tracer_mock.return_value.capture_lambda_handler.side_effect = _passthrough
_powertools_mock = MagicMock()
_powertools_mock.Logger = _logger_mock
_powertools_mock.Tracer = _tracer_mock
sys.modules["aws_lambda_powertools"] = _powertools_mock
sys.modules.setdefault("aws_lambda_powertools.utilities", MagicMock())
sys.modules.setdefault("aws_lambda_powertools.utilities.typing", MagicMock())


def _load(monkeypatch_env=None):
    for k, v in (monkeypatch_env or {}).items():
        os.environ[k] = v
    sys.modules.pop("index", None)
    return importlib.import_module("index")


def test_serial_status_value_pending_unavailable():
    idx = _load()
    assert idx.derive_serial_status({"ChassisSerial": "AMSS-9QCJ"}) == "AMSS-9QCJ"
    assert idx.derive_serial_status({"lastSerialCheck": "2026-05-25T00:00:00Z"}) == "Unavailable"
    assert idx.derive_serial_status({}) == "Pending"


def test_capture_due_only_when_untagged_and_back_off_elapsed():
    idx = _load()
    now = datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc)
    assert idx.capture_due({}, now) is True
    assert idx.capture_due({"ChassisSerial": "X"}, now) is False
    recent = now.replace(hour=11, minute=30).isoformat()
    assert idx.capture_due({"lastSerialCheck": recent}, now) is False
    old = now.replace(hour=10, minute=0).isoformat()
    assert idx.capture_due({"lastSerialCheck": old}, now) is True


def test_online_untagged_triggers_capture_invoke():
    idx = _load({"REGISTER_CAR_SERIAL_FUNCTION": "fn"})
    idx.client_lambda = MagicMock()
    idx.client_ssm = MagicMock()
    idx.client_ssm.list_tags_for_resource.return_value = {"TagList": []}
    idx.client_ssm.list_inventory_entries.return_value = {"Entries": []}
    event = {"Instances": {"InstanceInformationList": [
        {"InstanceId": "mi-1", "PingStatus": "Online", "ResourceType": "ManagedInstance"}]}}
    with patch.object(idx, "send_status_update"):
        idx.lambda_handler(event, None)
    idx.client_lambda.invoke.assert_called_once()
    assert idx.client_lambda.invoke.call_args.kwargs["InvocationType"] == "Event"
    import json
    assert json.loads(idx.client_lambda.invoke.call_args.kwargs["Payload"]) == {"managedInstanceId": "mi-1"}


def test_tagged_car_upserts_history():
    idx = _load({"CARS_HISTORY_TABLE": "history-table"})
    table_mock = MagicMock()
    idx._ddb.Table = MagicMock(return_value=table_mock)
    instance = {
        "ChassisSerial": "AMSS-9QCJ",
        "InstanceId": "mi-1",
        "ComputerName": "deepracer-abc",
    }
    idx.upsert_history(instance, datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc))
    table_mock.update_item.assert_called_once()
    kw = table_mock.update_item.call_args.kwargs
    assert kw["Key"] == {"chassisSerial": "AMSS-9QCJ", "managedInstanceId": "mi-1"}
    assert "#lastSeen=:lastSeen" in kw["UpdateExpression"]
    assert "#carName=:carName" in kw["UpdateExpression"]
    assert kw["ExpressionAttributeValues"][":carName"] == "deepracer-abc"
