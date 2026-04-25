"""Tests for stats compute module."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from compute import compute_event_stats, build_racer_event_summary
from models import MIN_VALID_LAP_MS


def _make_event(**overrides):
    base = {
        "eventId": "evt-1",
        "eventName": "Test Event",
        "eventDate": "2026-04-01",
        "typeOfEvent": "OFFICIAL_TRACK_RACE",
        "countryCode": "GB",
        "raceConfig": {"trackType": "REINVENT_2018"},
    }
    base.update(overrides)
    return base


def _make_race(user_id="user-1", track_id="track-1", laps=None, average_laps=None):
    return {
        "userId": user_id,
        "trackId": track_id,
        "laps": laps or [],
        "averageLaps": average_laps or [],
    }


def _make_lap(time_ms, is_valid=True, resets=0):
    return {"time": time_ms, "isValid": is_valid, "resets": resets}


class TestComputeEventStats:
    def test_returns_none_for_empty_races(self):
        result = compute_event_stats(_make_event(), [])
        assert result is None

    def test_counts_valid_laps(self):
        race = _make_race(laps=[
            _make_lap(7000),
            _make_lap(8000),
            _make_lap(3000, is_valid=False),
        ])
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.valid_lap_count == 2
        assert racer.invalid_lap_count == 1

    def test_sub_5s_laps_are_invalid(self):
        race = _make_race(laps=[
            _make_lap(4999, is_valid=True),
            _make_lap(6000, is_valid=True),
        ])
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.valid_lap_count == 1
        assert racer.best_lap_time_ms == 6000

    def test_best_lap_time(self):
        race = _make_race(laps=[
            _make_lap(8000),
            _make_lap(6500),
            _make_lap(7200),
        ])
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.best_lap_time_ms == 6500

    def test_avg_sanity_check_discards_bad_rolling_avg(self):
        race = _make_race(
            laps=[_make_lap(7000), _make_lap(8000)],
            average_laps=[{"avgTime": 6000}],
        )
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.best_avg_lap_ms is None

    def test_valid_rolling_avg_kept(self):
        race = _make_race(
            laps=[_make_lap(7000), _make_lap(8000)],
            average_laps=[{"avgTime": 7500}],
        )
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.best_avg_lap_ms == 7500

    def test_multiple_racers(self):
        race1 = _make_race(user_id="user-1", laps=[_make_lap(7000)])
        race2 = _make_race(user_id="user-2", laps=[_make_lap(6500)])
        stats = compute_event_stats(_make_event(), [race1, race2])
        assert stats.total_racers == 2
        assert stats.overall_best_lap_ms == 6500

    def test_event_totals(self):
        race1 = _make_race(user_id="user-1", laps=[_make_lap(7000), _make_lap(8000)])
        race2 = _make_race(user_id="user-2", laps=[_make_lap(6500)])
        stats = compute_event_stats(_make_event(), [race1, race2])
        assert stats.total_races == 2
        assert stats.total_valid_laps == 3

    def test_resets_counted(self):
        race = _make_race(laps=[_make_lap(7000, resets=2), _make_lap(8000, resets=1)])
        stats = compute_event_stats(_make_event(), [race])
        racer = stats.merged_racers["user-1"]
        assert racer.total_resets == 3

    def test_user_map_populates_username(self):
        race = _make_race(user_id="user-1", laps=[_make_lap(7000)])
        user_map = {"user-1": {"username": "alice", "countryCode": "US"}}
        stats = compute_event_stats(_make_event(), [race], user_map=user_map)
        racer = stats.merged_racers["user-1"]
        assert racer.username == "alice"
        assert racer.country_code == "US"


class TestBuildRacerEventSummary:
    def test_returns_summary_per_racer(self):
        race1 = _make_race(user_id="user-1", laps=[_make_lap(7000)])
        race2 = _make_race(user_id="user-2", laps=[_make_lap(6500)])
        stats = compute_event_stats(_make_event(), [race1, race2])
        summaries = build_racer_event_summary(stats)
        assert len(summaries) == 2

    def test_summary_fields(self):
        race = _make_race(laps=[_make_lap(7000), _make_lap(8000)])
        stats = compute_event_stats(_make_event(), [race])
        summaries = build_racer_event_summary(stats)
        s = summaries[0]
        assert s.best_lap_ms == 7000
        assert s.valid_lap_count == 2
        assert s.track_type == "REINVENT_2018"
        assert s.country_code == "GB"
