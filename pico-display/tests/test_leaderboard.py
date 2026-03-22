import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from leaderboard import parse_leaderboard

RAW = {
    "data": {
        "getLeaderboard": {
            "config": {"leaderBoardTitle": "DREM Cup 2026"},
            "entries": [
                {"username": "ALICE", "fastestLapTime": 13010.0, "avgLapTime": 14000.0},
                {"username": "DAVE",  "fastestLapTime": 12450.0, "avgLapTime": 13000.0},
                {"username": "BOB",   "fastestLapTime": 14220.0, "avgLapTime": 12500.0},
                {"username": "EVE",   "fastestLapTime": None,    "avgLapTime": None},
            ],
        }
    }
}

def test_fastest_format_sorts_by_fastest_lap():
    title, entries = parse_leaderboard(RAW, "fastest", top_n=10)
    assert [e["username"] for e in entries] == ["DAVE", "ALICE", "BOB", "EVE"]

def test_average_format_sorts_by_avg_lap():
    title, entries = parse_leaderboard(RAW, "average", top_n=10)
    assert [e["username"] for e in entries] == ["BOB", "DAVE", "ALICE", "EVE"]

def test_null_sorted_to_end():
    title, entries = parse_leaderboard(RAW, "fastest", top_n=10)
    assert entries[-1]["username"] == "EVE"

def test_top_n_slices_correctly():
    title, entries = parse_leaderboard(RAW, "fastest", top_n=2)
    assert len(entries) == 2
    assert entries[0]["username"] == "DAVE"
    assert entries[1]["username"] == "ALICE"

def test_position_reflects_full_board_rank():
    title, entries = parse_leaderboard(RAW, "fastest", top_n=2)
    assert entries[0]["position"] == 1
    assert entries[1]["position"] == 2

def test_position_assigned_before_slice():
    # Full board positions even though we only take top 1
    title, entries = parse_leaderboard(RAW, "fastest", top_n=1)
    assert entries[0]["position"] == 1  # position is board rank, not slice rank

def test_lap_times_stored_as_int_ms():
    title, entries = parse_leaderboard(RAW, "fastest", top_n=10)
    dave = next(e for e in entries if e["username"] == "DAVE")
    assert dave["fastest_lap_ms"] == 12450
    assert isinstance(dave["fastest_lap_ms"], int)

def test_title_returned():
    title, _ = parse_leaderboard(RAW, "fastest", top_n=5)
    assert title == "DREM Cup 2026"
