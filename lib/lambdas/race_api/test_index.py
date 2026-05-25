import os
import sys
from decimal import Decimal

# index.py builds boto3 resources + reads required env at import time.
os.environ.setdefault("AWS_DEFAULT_REGION", "eu-west-1")
os.environ.setdefault("DDB_TABLE", "race-table-test")
os.environ.setdefault("EVENT_BUS_NAME", "bus-test")
os.environ.setdefault("CARS_HISTORY_TABLE", "cars-history-test")
# dynamo_helpers ships as a Lambda layer; add it to the path for local import.
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "..", "lambda_layers", "helper_functions"),
)

import index  # noqa: E402


class _FakeTable:
    def __init__(self, items):
        self._items = items
        self.calls = []

    def query(self, **kwargs):
        self.calls.append(("query", kwargs))
        return {"Items": self._items}

    def scan(self, **kwargs):
        self.calls.append(("scan", kwargs))
        return {"Items": self._items}


def test_get_car_race_history_joins_and_converts_decimals(monkeypatch):
    history = [
        {"chassisSerial": "AMSS-9QCJ", "managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": None},
    ]
    races = [
        {"raceId": "r1", "eventId": "e1", "trackId": "1", "type": "race",
         "createdAt": "2026-01-10T00:00:00Z",
         "laps": [{"lapId": "l1", "carName": "LGW01", "time": Decimal("12.5"), "isValid": True}]},
    ]
    monkeypatch.setattr(index, "carsHistoryTable", _FakeTable(history))
    monkeypatch.setattr(index, "ddbTable", _FakeTable(races))

    out = index.getCarRaceHistory("AMSS-9QCJ")

    assert out["summary"]["totalRaces"] == 1
    assert out["activations"][0]["carName"] == "LGW01"
    # Decimal lap time must be converted to float for AppSync.
    assert isinstance(out["activations"][0]["races"][0]["laps"][0]["time"], float)


def test_get_car_race_history_empty_when_no_lineage(monkeypatch):
    monkeypatch.setattr(index, "carsHistoryTable", _FakeTable([]))
    monkeypatch.setattr(index, "ddbTable", _FakeTable([]))
    out = index.getCarRaceHistory("UNKNOWN")
    assert out["activations"] == []
    assert out["summary"]["totalRaces"] == 0
