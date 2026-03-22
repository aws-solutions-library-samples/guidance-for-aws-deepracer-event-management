import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from display import format_ms, format_s, build_race_string, build_leaderboard_string

def test_format_ms_zero():
    assert format_ms(0) == "00:00"

def test_format_ms_one_minute():
    assert format_ms(60_000) == "01:00"

def test_format_ms_two_minutes_34s():
    assert format_ms(154_000) == "02:34"

def test_format_s_simple():
    assert format_s(12_450) == "12.450s"

def test_format_s_rounds_to_3dp():
    assert format_s(12_001) == "12.001s"

def test_build_race_string_all_items():
    race = {
        "time_left_ms": 154_000,
        "laps": [{"isValid": True}, {"isValid": True}, {"isValid": False}],
        "fastest_lap_ms": 12_450,
        "last_lap_ms": 13_210,
        "resets": 2,
    }
    result = build_race_string(race, ["time_remaining", "laps_completed", "fastest_lap", "last_lap", "resets"])
    assert result == "02:34  ·  2 laps  ·  best 12.450s  ·  last 13.210s  ·  2 resets"

def test_build_race_string_omits_none_values():
    race = {"time_left_ms": 60_000, "laps": [], "fastest_lap_ms": None, "last_lap_ms": None, "resets": 0}
    result = build_race_string(race, ["time_remaining", "fastest_lap"])
    assert result == "01:00"  # fastest_lap omitted because None

def test_build_race_string_respects_item_order():
    race = {"time_left_ms": 60_000, "laps": [{"isValid": True}], "fastest_lap_ms": 10_000, "last_lap_ms": None, "resets": 1}
    result = build_race_string(race, ["resets", "time_remaining"])
    assert result == "1 resets  ·  01:00"

def test_build_leaderboard_string():
    lb = [
        {"position": 1, "username": "DAVE", "fastest_lap_ms": 12_450},
        {"position": 2, "username": "ALICE", "fastest_lap_ms": 13_010},
    ]
    result = build_leaderboard_string(lb)
    assert result == "#1 DAVE 12.450s  ·  #2 ALICE 13.010s"

def test_build_leaderboard_string_no_time():
    lb = [{"position": 1, "username": "BOB", "fastest_lap_ms": None}]
    result = build_leaderboard_string(lb)
    assert result == "#1 BOB ---"
