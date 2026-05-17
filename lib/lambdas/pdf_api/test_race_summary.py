"""Tests for race summary computation used by the PDF Lambda."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from race_summary import calculate_racer_summary, rank_racers


def _lap(time_ms, is_valid=True, resets=0):
    return {"time": time_ms, "isValid": is_valid, "resets": resets}


def _race(user_id="u1", track_id="t1", laps=None, average_laps=None):
    return {
        "userId": user_id,
        "trackId": track_id,
        "laps": laps or [],
        "averageLaps": average_laps or [],
    }


class TestCalculateRacerSummary:
    def test_fastest_valid_lap(self):
        races = [_race(laps=[_lap(8000), _lap(6500), _lap(7200)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] == 6500

    def test_invalid_laps_excluded(self):
        races = [_race(laps=[_lap(6500, is_valid=False), _lap(7200)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] == 7200
        assert s["numberOfValidLaps"] == 1
        assert s["numberOfInvalidLaps"] == 1

    def test_most_consecutive_laps(self):
        races = [_race(laps=[
            _lap(7000), _lap(7100), _lap(6500, is_valid=False),
            _lap(7200), _lap(7300), _lap(7400),
        ])]
        s = calculate_racer_summary("u1", races)
        assert s["mostConsecutiveLaps"] == 3

    def test_no_valid_laps(self):
        races = [_race(laps=[_lap(6500, is_valid=False)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] is None


class TestRankRacers:
    def test_rank_by_fastest_lap(self):
        summaries = [
            {"userId": "alice", "fastestLapTime": 7500},
            {"userId": "bob", "fastestLapTime": 6500},
            {"userId": "carol", "fastestLapTime": 7000},
        ]
        ranked = rank_racers(summaries, method="BEST_LAP_TIME")
        assert [r["userId"] for r in ranked] == ["bob", "carol", "alice"]
        assert ranked[0]["rank"] == 1
        assert ranked[2]["rank"] == 3

    def test_none_sorted_last(self):
        summaries = [
            {"userId": "alice", "fastestLapTime": 7500},
            {"userId": "bob", "fastestLapTime": None},
            {"userId": "carol", "fastestLapTime": 7000},
        ]
        ranked = rank_racers(summaries, method="BEST_LAP_TIME")
        assert ranked[-1]["userId"] == "bob"
