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


class _FakeCognito:
    """Returns canned ListUsers pages in order."""

    def __init__(self, pages):
        self.pages = list(pages)
        self.calls = []

    def list_users(self, **kwargs):
        self.calls.append(kwargs)
        return self.pages.pop(0)


def _event(event_id="evt-1"):
    return {
        "eventId": event_id,
        "eventName": f"Event {event_id}",
        "eventDate": "2026-04-01",
        "typeOfEvent": "AWS_SUMMIT",
        "countryCode": "GB",
        "raceConfig": {"trackType": "REINVENT_2018"},
    }


def _race(user_id):
    return {
        "userId": user_id,
        "trackId": "track-1",
        "type": "race",
        "laps": [{"time": 7000, "isValid": True, "resets": 0}],
        "averageLaps": [],
    }


def test_rebuild_resolves_usernames(monkeypatch):
    """fastestLapsEver carries the resolved racer name, not the sub prefix."""
    fake_stats = _FakeTable()
    monkeypatch.setattr(index, "stats_table", fake_stats)
    monkeypatch.setattr(index, "_scan_all_events", lambda: [_event()])
    monkeypatch.setattr(
        index,
        "_get_all_races_for_event",
        lambda eid: [_race("aaaaaaaa-1111-2222-3333-444444444444")],
    )
    monkeypatch.setattr(
        index,
        "_load_user_pool_index",
        lambda: {
            "aaaaaaaa-1111-2222-3333-444444444444": {
                "username": "alice",
                "countryCode": "GB",
            },
        },
    )

    index._rebuild_global_stats()

    fastest = fake_stats.put_items[-1]["fastestLapsEver"]
    assert fastest, "expected at least one fastest-lap entry"
    assert fastest[0]["username"] == "alice"


def test_rebuild_falls_back_for_deleted_user(monkeypatch):
    """A racer no longer in Cognito keeps the previous sub-prefix fallback."""
    fake_stats = _FakeTable()
    monkeypatch.setattr(index, "stats_table", fake_stats)
    monkeypatch.setattr(index, "_scan_all_events", lambda: [_event()])
    monkeypatch.setattr(
        index, "_get_all_races_for_event", lambda eid: [_race("ghost-user-deleted")]
    )
    monkeypatch.setattr(index, "_load_user_pool_index", lambda: {})

    index._rebuild_global_stats()

    fastest = fake_stats.put_items[-1]["fastestLapsEver"]
    assert fastest[0]["username"] == "ghost-us"  # uid[:8]


def test_rebuild_loads_user_pool_once(monkeypatch):
    """The pool scan runs once per rebuild, not per event."""
    events = [_event(f"evt-{i}") for i in range(5)]
    calls = {"n": 0}

    def _load():
        calls["n"] += 1
        return {"u": {"username": "alice", "countryCode": "GB"}}

    fake_stats = _FakeTable()
    monkeypatch.setattr(index, "stats_table", fake_stats)
    monkeypatch.setattr(index, "_scan_all_events", lambda: events)
    monkeypatch.setattr(index, "_get_all_races_for_event", lambda eid: [_race("u")])
    monkeypatch.setattr(index, "_load_user_pool_index", _load)

    index._rebuild_global_stats()

    assert calls["n"] == 1, f"expected one pool scan, got {calls['n']}"


def test_load_user_pool_index_paginates(monkeypatch):
    """ListUsers is paginated; both pages contribute to the returned index."""
    pages = [
        {
            "Users": [
                {
                    "Username": "alice",
                    "Attributes": [
                        {"Name": "sub", "Value": "sub-1"},
                        {"Name": "custom:countryCode", "Value": "GB"},
                    ],
                },
            ],
            "PaginationToken": "page-2",
        },
        {
            "Users": [
                {
                    "Username": "bob",
                    "Attributes": [
                        {"Name": "sub", "Value": "sub-2"},
                    ],
                },
            ],
        },
    ]
    fake = _FakeCognito(pages)
    monkeypatch.setattr(index, "cognito_client", fake)

    result = index._load_user_pool_index()

    assert result == {
        "sub-1": {"username": "alice", "countryCode": "GB"},
        "sub-2": {"username": "bob", "countryCode": ""},
    }
    assert len(fake.calls) == 2
    assert fake.calls[1].get("PaginationToken") == "page-2"


def test_load_user_pool_index_skips_users_without_sub(monkeypatch):
    """A pool row missing the sub attribute is dropped, not indexed by Username."""
    pages = [{"Users": [{"Username": "no-sub", "Attributes": []}]}]
    monkeypatch.setattr(index, "cognito_client", _FakeCognito(pages))
    assert index._load_user_pool_index() == {}
