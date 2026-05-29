"""Tests for the stats EVB global rebuild — racer name resolution."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__), "..", "..", "lambda_layers", "helper_functions"
    ),
)

os.environ.setdefault("STATS_TABLE", "stats")
os.environ.setdefault("RACE_TABLE", "race")
os.environ.setdefault("EVENTS_TABLE", "events")
os.environ.setdefault("USER_POOL_ID", "pool")
os.environ.setdefault("AWS_DEFAULT_REGION", "eu-west-1")

import index  # noqa: E402


class _FakeTable:
    def __init__(self):
        self.put_items = []

    def put_item(self, Item):
        self.put_items.append(Item)


def test_rebuild_resolves_usernames(monkeypatch):
    """fastestLapsEver must carry the resolved racer name, not the sub prefix."""
    event = {
        "eventId": "evt-1",
        "eventName": "Test Event",
        "eventDate": "2026-04-01",
        "typeOfEvent": "AWS_SUMMIT",
        "countryCode": "GB",
        "raceConfig": {"trackType": "REINVENT_2018"},
    }
    race = {
        "eventId": "evt-1",
        "userId": "aaaaaaaa-1111-2222-3333-444444444444",
        "trackId": "track-1",
        "type": "race",
        "laps": [{"time": 7000, "isValid": True, "resets": 0}],
        "averageLaps": [],
    }

    fake_stats = _FakeTable()
    monkeypatch.setattr(index, "stats_table", fake_stats)
    monkeypatch.setattr(index, "_scan_all_events", lambda: [event])
    monkeypatch.setattr(index, "_get_all_races_for_event", lambda eid: [race])
    monkeypatch.setattr(index, "_get_username_by_user_id", lambda uid: ("alice", "GB"))

    index._rebuild_global_stats()

    assert fake_stats.put_items, "expected global stats to be written"
    written = fake_stats.put_items[-1]
    fastest = written["fastestLapsEver"]
    assert fastest, "expected at least one fastest-lap entry"
    assert fastest[0]["username"] == "alice"


def test_rebuild_caches_cognito_lookups(monkeypatch):
    """The same racer across multiple events is resolved against Cognito once."""
    events = [
        {
            "eventId": f"evt-{i}",
            "eventName": f"Event {i}",
            "eventDate": "2026-04-01",
            "typeOfEvent": "AWS_SUMMIT",
            "countryCode": "GB",
            "raceConfig": {"trackType": "REINVENT_2018"},
        }
        for i in range(3)
    ]
    race = {
        "userId": "shared-user",
        "trackId": "track-1",
        "type": "race",
        "laps": [{"time": 7000, "isValid": True, "resets": 0}],
        "averageLaps": [],
    }

    calls = []

    def _resolve(uid):
        calls.append(uid)
        return ("alice", "GB")

    fake_stats = _FakeTable()
    monkeypatch.setattr(index, "stats_table", fake_stats)
    monkeypatch.setattr(index, "_scan_all_events", lambda: events)
    monkeypatch.setattr(index, "_get_all_races_for_event", lambda eid: [race])
    monkeypatch.setattr(index, "_get_username_by_user_id", _resolve)

    index._rebuild_global_stats()

    assert calls == ["shared-user"], f"expected one Cognito lookup, got {calls}"
