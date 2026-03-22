import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from race import derive_race_state

def _overlay(**kwargs):
    base = {
        "raceStatus": "RACE_IN_PROGRESS",
        "username": "DAVE",
        "eventName": "DREM Cup",
        "timeLeftInMs": 90000.0,
        "currentLapTimeInMs": 5000.0,
        "laps": [],
    }
    base.update(kwargs)
    return base

def test_resets_summed_across_laps():
    # Invalid laps still contribute resets (resets are device-level events, not per-valid-lap)
    o = _overlay(laps=[
        {"time": 12000.0, "isValid": True,  "resets": 1},
        {"time": 13000.0, "isValid": True,  "resets": 2},
        {"time": 99000.0, "isValid": False, "resets": 1},  # invalid but resets still count
    ])
    state = derive_race_state(o)
    assert state["resets"] == 4

def test_fastest_lap_is_min_valid():
    o = _overlay(laps=[
        {"time": 13000.0, "isValid": True,  "resets": 0},
        {"time": 12000.0, "isValid": True,  "resets": 0},
        {"time":  5000.0, "isValid": False, "resets": 0},  # invalid — excluded
    ])
    state = derive_race_state(o)
    assert state["fastest_lap_ms"] == 12000

def test_fastest_lap_none_when_no_valid_laps():
    o = _overlay(laps=[{"time": 5000.0, "isValid": False, "resets": 0}])
    state = derive_race_state(o)
    assert state["fastest_lap_ms"] is None

def test_last_lap_is_last_valid_by_array_order():
    # Last valid by array position, NOT by largest time value.
    # The last valid lap here has a SMALLER time (12000) than the first (15000),
    # proving the implementation uses insertion order not time comparison.
    o = _overlay(laps=[
        {"time": 15000.0, "isValid": True,  "resets": 0},
        {"time": 12000.0, "isValid": True,  "resets": 0},  # last valid, smaller time
        {"time": 99000.0, "isValid": False, "resets": 0},
    ])
    state = derive_race_state(o)
    assert state["last_lap_ms"] == 12000  # last valid by position, not max time

def test_last_lap_none_when_no_valid_laps():
    o = _overlay(laps=[])
    state = derive_race_state(o)
    assert state["last_lap_ms"] is None

def test_time_left_cast_to_int():
    o = _overlay(timeLeftInMs=90000.7)
    state = derive_race_state(o)
    assert state["time_left_ms"] == 90000
    assert isinstance(state["time_left_ms"], int)

def test_lap_times_stored_as_int_ms():
    o = _overlay(laps=[{"time": 12450.6, "isValid": True, "resets": 0}])
    state = derive_race_state(o)
    assert state["fastest_lap_ms"] == 12451  # round(12450.6)
    assert state["last_lap_ms"] == 12451

def test_status_and_username_passed_through():
    o = _overlay(raceStatus="RACE_PAUSED", username="ALICE")
    state = derive_race_state(o)
    assert state["status"] == "RACE_PAUSED"
    assert state["username"] == "ALICE"

def test_empty_laps_gives_zero_resets():
    o = _overlay(laps=[])
    state = derive_race_state(o)
    assert state["resets"] == 0
