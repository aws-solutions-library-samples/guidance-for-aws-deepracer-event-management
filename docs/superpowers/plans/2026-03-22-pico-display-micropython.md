# Pico W Galactic Unicorn — MicroPython App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the MicroPython application that runs on a Raspberry Pi Pico W + Pimoroni Galactic Unicorn to display live DREM race data on the 53×11 LED matrix.

**Architecture:** Three `uasyncio` tasks (display, race WebSocket, leaderboard HTTP poll) read from and write to a single shared `State` object. Business logic (config validation, data derivation, string building) lives in pure functions that are fully testable on CPython. Hardware interaction (WiFi, WebSocket, LED rendering) is isolated to thin wrapper functions that are not unit tested.

**Tech Stack:** MicroPython 1.23+, Pimoroni Galactic Unicorn firmware, `uasyncio`, `urequests`, `ubinascii`; tests run on CPython 3.11+ with `pytest`.

**Spec:** `docs/superpowers/specs/2026-03-22-pico-display-design.md`

---

## File Map

| File | Created/Modified | Responsibility |
|------|-----------------|----------------|
| `pico-display/.gitignore` | Create | Exclude `config.json` (contains WiFi password) |
| `pico-display/pytest.ini` | Create | Pytest config to discover `tests/` |
| `pico-display/state.py` | Create | Shared `State` object (plain namespace, no locking) |
| `pico-display/config.py` | Create | Load `config.json`, validate all fields, raise `ConfigError` |
| `pico-display/display.py` | Create | String builders (pure), time formatters (pure), GU hardware driver |
| `pico-display/leaderboard.py` | Create | Parse/sort logic (pure), HTTP polling task |
| `pico-display/race.py` | Create | Derivation logic (pure), WebSocket task with reconnect |
| `pico-display/wifi.py` | Create | WiFi connect/reconnect wrapper |
| `pico-display/main.py` | Create | Boot sequence, launches uasyncio tasks |
| `pico-display/config.json.example` | Create | Template config with placeholder values |
| `pico-display/README.md` | Create | Hardware setup and flashing guide |
| `pico-display/tests/__init__.py` | Create | Empty, marks tests as package |
| `pico-display/tests/test_config.py` | Create | Validation rules, required fields, ConfigError |
| `pico-display/tests/test_display.py` | Create | `format_ms`, `format_s`, `build_race_string`, `build_leaderboard_string` |
| `pico-display/tests/test_leaderboard.py` | Create | `parse_leaderboard`: sort order, null handling, position, top_n slicing |
| `pico-display/tests/test_race.py` | Create | `derive_race_state`: resets sum, fastest/last lap, null fallbacks |

---

## Task 1: Project scaffolding

**Files:**
- Create: `pico-display/.gitignore`
- Create: `pico-display/pytest.ini`
- Create: `pico-display/tests/__init__.py`

- [ ] **Step 1: Create the directory and scaffolding files**

```bash
mkdir -p pico-display/tests
```

`pico-display/.gitignore`:
```
config.json
__pycache__/
*.pyc
.pytest_cache/
```

`pico-display/pytest.ini`:
```ini
[pytest]
testpaths = tests
```

`pico-display/tests/__init__.py`:
```python
```

- [ ] **Step 2: Verify pytest discovers the (empty) tests directory**

```bash
cd pico-display && python -m pytest --collect-only
```
Expected: `no tests ran`

- [ ] **Step 3: Commit**

```bash
git add pico-display/
git commit -m "feat: scaffold pico-display project directory"
```

---

## Task 2: Shared State object

**Files:**
- Create: `pico-display/state.py`

- [ ] **Step 1: Write `state.py`**

```python
class State:
    """
    Shared mutable state written by network tasks, read by display_task.
    Single-core MicroPython: no locking required.
    """
    event_name = None          # str | None — from eventName in subscription
    leaderboard_title = ""     # str — from getLeaderboard config.leaderBoardTitle
    leaderboard = []           # list[dict] — top N sorted entries
    race = None                # dict | None — current race data; None when no race active
```

- [ ] **Step 2: Commit**

```bash
git add pico-display/state.py
git commit -m "feat(pico): add shared State object"
```

---

## Task 3: Config loading and validation

**Files:**
- Create: `pico-display/config.py`
- Create: `pico-display/tests/test_config.py`

- [ ] **Step 1: Write the failing tests**

`pico-display/tests/test_config.py`:
```python
import json
import os
import pytest

# Allow importing config.py from parent directory
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import validate_config, ConfigError

VALID = {
    "wifi": {"ssid": "net", "password": "pass"},
    "appsync": {
        "endpoint": "https://x.appsync-api.eu-west-1.amazonaws.com/graphql",
        "api_key": "da2-abc",
        "region": "eu-west-1",
    },
    "event": {"event_id": "uuid-1", "track_id": "1", "race_format": "fastest"},
    "display": {
        "brightness": 0.5,
        "scroll_speed": 40,
        "leaderboard_poll_interval": 30,
        "leaderboard_top_n": 5,
        "race_items": ["time_remaining", "laps_completed"],
    },
}

def test_valid_config_passes():
    validate_config(VALID)  # must not raise

def test_missing_wifi_ssid_raises():
    cfg = {**VALID, "wifi": {"password": "p"}}
    with pytest.raises(ConfigError, match="wifi.ssid"):
        validate_config(cfg)

def test_missing_appsync_endpoint_raises():
    import copy; cfg = copy.deepcopy(VALID)
    del cfg["appsync"]["endpoint"]
    with pytest.raises(ConfigError, match="appsync.endpoint"):
        validate_config(cfg)

def test_missing_event_id_raises():
    import copy; cfg = copy.deepcopy(VALID)
    del cfg["event"]["event_id"]
    with pytest.raises(ConfigError, match="event.event_id"):
        validate_config(cfg)

def test_missing_track_id_raises():
    import copy; cfg = copy.deepcopy(VALID)
    del cfg["event"]["track_id"]
    with pytest.raises(ConfigError, match="event.track_id"):
        validate_config(cfg)

def test_invalid_race_format_raises():
    import copy; cfg = copy.deepcopy(VALID)
    cfg["event"]["race_format"] = "sprint"
    with pytest.raises(ConfigError, match="race_format"):
        validate_config(cfg)

def test_average_race_format_passes():
    import copy; cfg = copy.deepcopy(VALID)
    cfg["event"]["race_format"] = "average"
    validate_config(cfg)  # must not raise
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
cd pico-display && python -m pytest tests/test_config.py -v
```
Expected: `ImportError: No module named 'config'`

- [ ] **Step 3: Implement `config.py`**

```python
try:
    import ujson as json
except ImportError:
    import json


class ConfigError(Exception):
    pass


def _require(cfg, *path):
    """Traverse nested dict by path; raise ConfigError if missing or empty."""
    node = cfg
    key_path = ".".join(path)
    for key in path:
        if not isinstance(node, dict) or key not in node or node[key] in (None, ""):
            raise ConfigError(f"Missing required config field: {key_path}")
        node = node[key]
    return node


def validate_config(cfg):
    _require(cfg, "wifi", "ssid")
    _require(cfg, "wifi", "password")
    _require(cfg, "appsync", "endpoint")
    _require(cfg, "appsync", "api_key")
    _require(cfg, "appsync", "region")
    _require(cfg, "event", "event_id")
    _require(cfg, "event", "track_id")
    fmt = _require(cfg, "event", "race_format")
    if fmt not in ("fastest", "average"):
        raise ConfigError(
            f"Invalid race_format '{fmt}': must be 'fastest' or 'average'"
        )


def load_config(path="config.json"):
    try:
        with open(path) as f:
            cfg = json.load(f)
    except OSError:
        raise ConfigError("config.json not found")
    except ValueError:
        raise ConfigError("config.json is not valid JSON")
    validate_config(cfg)
    return cfg
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd pico-display && python -m pytest tests/test_config.py -v
```
Expected: 7 PASSED

- [ ] **Step 5: Commit**

```bash
git add pico-display/config.py pico-display/tests/test_config.py
git commit -m "feat(pico): config loading and validation with ConfigError"
```

---

## Task 4: Display string builders and time formatters

**Files:**
- Create: `pico-display/display.py` (pure functions only in this task)
- Create: `pico-display/tests/test_display.py`

- [ ] **Step 1: Write the failing tests**

`pico-display/tests/test_display.py`:
```python
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd pico-display && python -m pytest tests/test_display.py -v
```
Expected: `ImportError: No module named 'display'`

- [ ] **Step 3: Implement pure functions in `display.py`**

```python
# display.py
# Top section: pure business logic (testable on CPython)
# Bottom section: hardware driver (Galactic Unicorn, only runs on Pico)

DIVIDER = "  ·  "


def format_ms(ms):
    """Format integer milliseconds as MM:SS (for time remaining)."""
    total_s = int(ms) // 1000
    m = total_s // 60
    s = total_s % 60
    return f"{m:02d}:{s:02d}"


def format_s(ms):
    """Format integer milliseconds as SS.sssS (for lap times)."""
    return f"{int(ms) / 1000:.3f}s"


def build_race_string(race, race_items):
    """
    Build the scrolling race text from State.race and config race_items list.
    Items with None values are silently omitted.
    """
    valid_count = sum(1 for lap in race.get("laps", []) if lap.get("isValid") is True)
    parts = []
    for item in race_items:
        if item == "time_remaining":
            t = race.get("time_left_ms")
            if t is not None:
                parts.append(format_ms(t))
        elif item == "laps_completed":
            parts.append(f"{valid_count} laps")
        elif item == "fastest_lap":
            t = race.get("fastest_lap_ms")
            if t is not None:
                parts.append(f"best {format_s(t)}")
        elif item == "last_lap":
            t = race.get("last_lap_ms")
            if t is not None:
                parts.append(f"last {format_s(t)}")
        elif item == "resets":
            parts.append(f"{race.get('resets', 0)} resets")
    return DIVIDER.join(parts)


def build_leaderboard_string(leaderboard):
    """Build the scrolling idle leaderboard ticker text."""
    parts = []
    for entry in leaderboard:
        t = entry.get("fastest_lap_ms")
        t_str = format_s(t) if t is not None else "---"
        parts.append(f"#{entry['position']} {entry['username']} {t_str}")
    return DIVIDER.join(parts)


# ---------------------------------------------------------------------------
# Hardware driver — only importable on Pimoroni Galactic Unicorn firmware
# ---------------------------------------------------------------------------
# Colours (R, G, B)
COLOUR_YELLOW  = (255, 220, 0)
COLOUR_CYAN    = (0, 240, 255)
COLOUR_GREEN   = (0, 255, 80)
COLOUR_WHITE   = (255, 255, 255)
COLOUR_ORANGE  = (255, 120, 0)
COLOUR_RED     = (255, 0, 0)

ITEM_COLOURS = {
    "time_remaining": COLOUR_YELLOW,
    "laps_completed": COLOUR_CYAN,
    "fastest_lap":    COLOUR_GREEN,
    "last_lap":       COLOUR_WHITE,
    "resets":         COLOUR_ORANGE,
}


class Display:
    """
    Hardware driver wrapping GalacticUnicorn.
    Not unit-tested — requires Pimoroni firmware.
    """

    WIDTH = 53
    HEIGHT = 11
    SCROLL_RATE_HZ = 60         # ticks per second for the scroll loop

    def __init__(self, brightness=0.5, scroll_speed=40):
        from galactic import GalacticUnicorn
        from picographics import PicoGraphics, DISPLAY_GALACTIC_UNICORN
        self._gu = GalacticUnicorn()
        self._pg = PicoGraphics(display=DISPLAY_GALACTIC_UNICORN)
        self._gu.set_brightness(brightness)
        self._scroll_speed = scroll_speed   # pixels per second
        self._x_offset = 0
        self._text = ""
        self._colour = COLOUR_WHITE

    def set_text(self, text, colour=COLOUR_WHITE):
        self._text = text
        self._colour = colour
        self._x_offset = self.WIDTH  # start scrolling from the right

    def tick(self):
        """Called every frame; advances scroll by scroll_speed/SCROLL_RATE_HZ pixels."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_pen(self._pg.create_pen(*self._colour))
        self._pg.text(self._text, self._x_offset, 2, scale=1)
        self._gu.update(self._pg)
        self._x_offset -= max(1, self._scroll_speed // self.SCROLL_RATE_HZ)

    def scroll_complete(self):
        """True when text has fully scrolled off the left edge."""
        text_width = len(self._text) * 6  # approximate 6px per char
        return self._x_offset < -text_width

    def flash(self, colour, duration_ms=500):
        """Synchronous flash — blocks for duration_ms (use only from display_task)."""
        import utime
        self._pg.set_pen(self._pg.create_pen(*colour))
        self._pg.clear()
        self._gu.update(self._pg)
        utime.sleep_ms(duration_ms)
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._gu.update(self._pg)

    def show_status(self, text, colour=COLOUR_WHITE):
        """Show a static short status string centred on the display."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_pen(self._pg.create_pen(*colour))
        x = max(0, (self.WIDTH - len(text) * 6) // 2)
        self._pg.text(text, x, 2, scale=1)
        self._gu.update(self._pg)
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd pico-display && python -m pytest tests/test_display.py -v
```
Expected: 10 PASSED

- [ ] **Step 5: Commit**

```bash
git add pico-display/display.py pico-display/tests/test_display.py
git commit -m "feat(pico): display string builders and time formatters with tests"
```

---

## Task 5: Leaderboard parse and sort logic

**Files:**
- Create: `pico-display/leaderboard.py`
- Create: `pico-display/tests/test_leaderboard.py`

- [ ] **Step 1: Write the failing tests**

`pico-display/tests/test_leaderboard.py`:
```python
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd pico-display && python -m pytest tests/test_leaderboard.py -v
```
Expected: `ImportError: No module named 'leaderboard'`

- [ ] **Step 3: Implement parse/sort logic in `leaderboard.py`**

```python
# leaderboard.py
# Top section: pure parse/sort logic (testable on CPython)
# Bottom section: HTTP polling task (requires network, not unit tested)


def parse_leaderboard(data, race_format, top_n):
    """
    Parse a raw getLeaderboard GraphQL response.
    Returns (leaderboard_title, entries[:top_n]) where entries have:
      position, username, fastest_lap_ms
    and are sorted by the given race_format.
    """
    board = data["data"]["getLeaderboard"]
    title = board["config"].get("leaderBoardTitle", "")
    raw_entries = board.get("entries") or []

    parsed = []
    for e in raw_entries:
        ft = e.get("fastestLapTime")
        at = e.get("avgLapTime")
        parsed.append({
            "username": e.get("username", ""),
            "fastest_lap_ms": int(round(ft)) if ft is not None else None,
            "_avg_ms": int(round(at)) if at is not None else None,
        })

    _INF = float("inf")
    if race_format == "fastest":
        parsed.sort(key=lambda x: x["fastest_lap_ms"] if x["fastest_lap_ms"] is not None else _INF)
    else:  # "average"
        parsed.sort(key=lambda x: x["_avg_ms"] if x["_avg_ms"] is not None else _INF)

    # Assign position from full sorted board, then slice
    for i, entry in enumerate(parsed):
        entry["position"] = i + 1
        del entry["_avg_ms"]  # not needed in State

    return title, parsed[:top_n]


# ---------------------------------------------------------------------------
# HTTP polling task — requires network; not unit tested
# ---------------------------------------------------------------------------
LEADERBOARD_QUERY = """
query GetLeaderboard($eventId: ID!, $trackId: ID) {
  getLeaderboard(eventId: $eventId, trackId: $trackId) {
    config { leaderBoardTitle }
    entries {
      username fastestLapTime avgLapTime numberOfValidLaps countryCode
    }
  }
}
"""


async def leaderboard_task(config, state):
    """
    Polls AppSync getLeaderboard every leaderboard_poll_interval seconds.
    Writes to state.leaderboard and state.leaderboard_title.
    """
    import uasyncio as asyncio
    try:
        import urequests as requests
    except ImportError:
        import requests

    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    race_format = config["event"]["race_format"]
    poll_interval = config["display"].get("leaderboard_poll_interval", 30)
    top_n = config["display"].get("leaderboard_top_n", 5)
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}

    while True:
        try:
            import ujson as json
        except ImportError:
            import json
        payload = json.dumps({
            "query": LEADERBOARD_QUERY,
            "variables": {"eventId": event_id, "trackId": track_id},
        })
        try:
            resp = requests.post(endpoint, headers=headers, data=payload)
            data = resp.json()
            resp.close()
            title, entries = parse_leaderboard(data, race_format, top_n)
            if title:
                state.leaderboard_title = title
            state.leaderboard = entries
        except Exception as e:
            print(f"leaderboard_task error: {e}")
            # retain stale leaderboard; retry next interval

        await asyncio.sleep(poll_interval)
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd pico-display && python -m pytest tests/test_leaderboard.py -v
```
Expected: 8 PASSED

- [ ] **Step 5: Commit**

```bash
git add pico-display/leaderboard.py pico-display/tests/test_leaderboard.py
git commit -m "feat(pico): leaderboard parse/sort logic with tests"
```

---

## Task 6: Race data derivation logic

**Files:**
- Create: `pico-display/race.py`
- Create: `pico-display/tests/test_race.py`

- [ ] **Step 1: Write the failing tests**

`pico-display/tests/test_race.py`:
```python
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd pico-display && python -m pytest tests/test_race.py -v
```
Expected: `ImportError: No module named 'race'`

- [ ] **Step 3: Implement derivation logic in `race.py`**

```python
# race.py
# Top section: pure derivation logic (testable on CPython)
# Bottom section: WebSocket task (requires network, not unit tested)


def derive_race_state(overlay):
    """
    Derive structured race state from a raw onNewOverlayInfo payload dict.
    Returns a dict suitable for State.race.
    """
    laps = overlay.get("laps") or []
    resets = sum(lap.get("resets") or 0 for lap in laps)
    valid_times = [lap["time"] for lap in laps if lap.get("isValid") is True]
    fastest_lap_ms = int(round(min(valid_times))) if valid_times else None
    valid_laps = [lap for lap in laps if lap.get("isValid") is True]
    last_lap_ms = int(round(valid_laps[-1]["time"])) if valid_laps else None
    return {
        "status": overlay["raceStatus"],
        "username": overlay.get("username") or "",
        "time_left_ms": int(overlay.get("timeLeftInMs") or 0),
        "laps": laps,
        "resets": resets,
        "fastest_lap_ms": fastest_lap_ms,
        "last_lap_ms": last_lap_ms,
    }


# ---------------------------------------------------------------------------
# WebSocket subscription task — requires network; not unit tested
# ---------------------------------------------------------------------------
SUBSCRIPTION_QUERY = (
    "subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) {"
    " onNewOverlayInfo(eventId: $eventId, trackId: $trackId) {"
    " eventId eventName trackId username raceStatus"
    " timeLeftInMs currentLapTimeInMs"
    " laps { lapId time isValid resets }"
    " countryCode } }"
)

RACE_STATUSES = {"READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED", "RACE_FINSIHED", "RACE_SUBMITTED"}


def _build_ws_url(config):
    """Build the AppSync real-time WebSocket URL with base64url-encoded header+payload."""
    try:
        import ubinascii
        b64 = lambda s: ubinascii.b2a_base64(s.encode()).decode().strip()
    except ImportError:
        import base64
        b64 = lambda s: base64.b64encode(s.encode()).decode()

    try:
        import ujson as json
    except ImportError:
        import json

    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    region = config["appsync"]["region"]
    # Derive host from HTTP endpoint
    host = endpoint.replace("https://", "").replace("/graphql", "")
    rt_host = host.replace("appsync-api", "appsync-realtime-api")
    header = b64(json.dumps({"host": host, "x-api-key": api_key}))
    payload = b64("{}")
    return f"wss://{rt_host}/graphql?header={header}&payload={payload}"


async def race_task(config, state, display):
    """
    Maintains a graphql-ws WebSocket to AppSync.
    Subscribes to onNewOverlayInfo and writes to state.race.
    On race-end statuses, signals display to flash.
    Uses exponential backoff on disconnect.
    """
    import uasyncio as asyncio
    try:
        import uwebsocket as ws_lib
    except ImportError:
        import websocket as ws_lib  # desktop fallback for manual testing

    try:
        import ujson as json
    except ImportError:
        import json

    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    url = _build_ws_url(config)
    backoff = 2

    while True:
        try:
            ws = ws_lib.connect(url, subprotocols=["graphql-ws"])
            # Connection handshake
            ws.send(json.dumps({"type": "connection_init"}))
            while True:
                msg = json.loads(ws.recv())
                if msg.get("type") == "connection_ack":
                    break

            # Subscribe
            ws.send(json.dumps({
                "id": "1",
                "type": "start",
                "payload": {
                    "query": SUBSCRIPTION_QUERY,
                    "variables": {"eventId": event_id, "trackId": track_id},
                },
            }))

            backoff = 2  # reset on successful connect
            last_data_ms = _now_ms()

            while True:
                await asyncio.sleep_ms(50)
                msg_raw = ws.recv()
                if not msg_raw:
                    if _now_ms() - last_data_ms > 10_000:
                        display.show_status("RECONNECTING...", (255, 120, 0))
                    continue
                msg = json.loads(msg_raw)
                if msg.get("type") == "ka":
                    continue  # keep-alive, ignore
                if msg.get("type") != "data":
                    continue
                last_data_ms = _now_ms()
                overlay = msg["payload"]["data"]["onNewOverlayInfo"]
                _handle_overlay(overlay, state, display)

        except Exception as e:
            print(f"race_task error: {e}")
            display.show_status("RECONNECTING...", (255, 120, 0))
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def _now_ms():
    try:
        import utime
        return utime.ticks_ms()
    except ImportError:
        import time
        return int(time.time() * 1000)


def _handle_overlay(overlay, state, display):
    """Dispatch on raceStatus and update state/display accordingly."""
    status = overlay.get("raceStatus", "")
    event_name = overlay.get("eventName") or ""
    if event_name:
        state.event_name = event_name

    if status == "NO_RACER_SELECTED":
        state.race = None
        return

    if status in ("READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED", "RACE_FINSIHED"):
        state.race = derive_race_state(overlay)

    if status == "RACE_FINSIHED":
        # display_task polls state.race["status"] and triggers the flash
        pass

    if status == "RACE_SUBMITTED":
        # Signal via sentinel; display_task handles the flash using stored fastest_lap_ms
        if state.race:
            state.race = {**state.race, "status": "RACE_SUBMITTED"}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd pico-display && python -m pytest tests/test_race.py -v
```
Expected: 9 PASSED

- [ ] **Step 5: Commit**

```bash
git add pico-display/race.py pico-display/tests/test_race.py
git commit -m "feat(pico): race data derivation logic with tests"
```

---

## Task 7: WiFi connection module

**Files:**
- Create: `pico-display/wifi.py`

This module has no pure-logic functions worth unit testing — it wraps MicroPython's `network` module directly. Manual hardware testing covers it.

- [ ] **Step 1: Implement `wifi.py`**

```python
# wifi.py — MicroPython only; requires network module
import utime

try:
    import network
    import uasyncio as asyncio
    _ON_PICO = True
except ImportError:
    _ON_PICO = False


async def connect(config, display):
    """Connect to WiFi on boot. Retries up to 10 times with 2s delay."""
    if not _ON_PICO:
        return
    ssid = config["wifi"]["ssid"]
    password = config["wifi"]["password"]
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    for attempt in range(10):
        display.show_status("CONNECTING...", (255, 255, 255))
        if wlan.isconnected():
            return
        await asyncio.sleep(2)
    # Exhausted retries — fail loudly
    display.show_status("NO WIFI", (255, 0, 0))
    raise OSError("WiFi connection failed after 10 attempts")


async def watch(display):
    """Background task: monitors WiFi and shows NO WIFI when disconnected."""
    if not _ON_PICO:
        return
    import network as net
    import uasyncio as asyncio
    wlan = net.WLAN(net.STA_IF)
    while True:
        await asyncio.sleep(5)
        if not wlan.isconnected():
            display.show_status("NO WIFI", (255, 0, 0))
```

- [ ] **Step 2: Commit**

```bash
git add pico-display/wifi.py
git commit -m "feat(pico): wifi connect and reconnect watcher"
```

---

## Task 8: Display task (mode switching, scroll loop, flash)

**Files:**
- Modify: `pico-display/display.py` — add `display_task` async function

**Note on colour coding:** The spec defines per-item colours (time=yellow, laps=cyan, etc.). The `ITEM_COLOURS` dict is defined in `display.py` for reference, but the Galactic Unicorn's `PicoGraphics.text()` renders a whole string in one colour. Per-segment multi-colour rendering requires a custom pixel-font blit loop and is deferred to a future enhancement. For now, race scroll text is rendered in white; the flash colours (orange reset, green finish) are correctly implemented.

- [ ] **Step 1: Add `display_task` to `display.py`**

Append to the bottom of `display.py` (after the `Display` class):

```python
# Idle cycle interval in seconds
IDLE_CYCLE_S = 10
# Race-finished flash duration in seconds
RACE_FINISH_FLASH_S = 5
# Reset flash duration in ms
RESET_FLASH_MS = 500


async def display_task(display, state, config):
    """
    Main display loop. Runs at SCROLL_RATE_HZ; switches between idle and race modes.
    """
    try:
        import uasyncio as asyncio
    except ImportError:
        import asyncio

    race_items = config["display"].get("race_items", [])
    idle_mode = "branding"       # "branding" or "leaderboard"
    idle_timer = 0
    frame_ms = 1000 // Display.SCROLL_RATE_HZ
    prev_resets = 0

    while True:
        await asyncio.sleep_ms(frame_ms)
        idle_timer += frame_ms

        race = state.race

        # --- Race mode ---
        if race and race.get("status") in ("READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED"):
            resets = race.get("resets", 0)
            if resets > prev_resets:
                display.flash(COLOUR_ORANGE, RESET_FLASH_MS)
            prev_resets = resets
            text = build_race_string(race, race_items)
            display.set_text(text, COLOUR_WHITE)
            display.tick()
            continue

        # --- Race finished flash ---
        if race and race.get("status") in ("RACE_FINSIHED", "RACE_SUBMITTED"):
            best = race.get("fastest_lap_ms")
            if best is not None:
                flash_text = format_s(best)
                display.show_status(flash_text, COLOUR_GREEN)
                await asyncio.sleep(RACE_FINISH_FLASH_S)
            state.race = None
            prev_resets = 0
            idle_timer = 0
            continue

        # --- Idle mode ---
        if idle_timer >= IDLE_CYCLE_S * 1000:
            idle_mode = "leaderboard" if idle_mode == "branding" else "branding"
            idle_timer = 0

        if idle_mode == "branding":
            name = state.event_name or state.leaderboard_title or "DREM"
            display.show_status(name, COLOUR_WHITE)
        else:
            if state.leaderboard:
                text = build_leaderboard_string(state.leaderboard)
                display.set_text(text, COLOUR_WHITE)
                display.tick()
            else:
                name = state.event_name or state.leaderboard_title or "DREM"
                display.show_status(name, COLOUR_WHITE)
```

- [ ] **Step 2: Confirm existing display tests still pass (no regressions)**

```bash
cd pico-display && python -m pytest tests/test_display.py -v
```
Expected: 9 PASSED

- [ ] **Step 3: Commit**

```bash
git add pico-display/display.py
git commit -m "feat(pico): display_task with idle/race mode switching and flash"
```

---

## Task 9: Entry point

**Files:**
- Create: `pico-display/main.py`

- [ ] **Step 1: Implement `main.py`**

```python
# main.py — entry point; runs on Pico W
import uasyncio as asyncio


async def boot():
    from config import load_config, ConfigError
    from state import State
    from display import Display, display_task
    from wifi import connect as wifi_connect, watch as wifi_watch
    from leaderboard import leaderboard_task
    from race import race_task

    cfg = None
    # Minimal display needed before config loads
    try:
        disp = Display(brightness=0.5)
    except ImportError:
        raise SystemExit("Not running on Galactic Unicorn firmware")

    try:
        cfg = load_config()
    except Exception as e:
        disp.show_status("CONFIG ERROR", (255, 0, 0))
        raise SystemExit(str(e))

    disp_configured = Display(
        brightness=cfg["display"].get("brightness", 0.5),
        scroll_speed=cfg["display"].get("scroll_speed", 40),
    )

    await wifi_connect(cfg, disp_configured)

    state = State()

    await asyncio.gather(
        display_task(disp_configured, state, cfg),
        leaderboard_task(cfg, state),
        race_task(cfg, state, disp_configured),
        wifi_watch(disp_configured),
    )


try:
    asyncio.run(boot())
except Exception as e:
    # Last-resort crash handler: show exception then reboot
    try:
        from display import Display
        d = Display()
        d.show_status(str(e)[:10], (255, 0, 0))
        import utime
        utime.sleep(10)
    except Exception:
        pass
    import machine
    machine.reset()
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
cd pico-display && python -m pytest -v
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add pico-display/main.py
git commit -m "feat(pico): main.py boot sequence with crash recovery"
```

---

## Task 10: Example config and README

**Files:**
- Create: `pico-display/config.json.example`
- Create: `pico-display/README.md`

- [ ] **Step 1: Create `config.json.example`**

```json
{
  "wifi": {
    "ssid": "YourNetworkName",
    "password": "YourWiFiPassword"
  },
  "appsync": {
    "endpoint": "https://XXXXXXXXXXXX.appsync-api.eu-west-1.amazonaws.com/graphql",
    "api_key": "da2-XXXXXXXXXXXXXXXXXXXXXXXXXX",
    "region": "eu-west-1"
  },
  "event": {
    "event_id": "paste-event-id-from-drem-here",
    "track_id": "1",
    "race_format": "fastest"
  },
  "display": {
    "brightness": 0.5,
    "scroll_speed": 40,
    "leaderboard_poll_interval": 30,
    "leaderboard_top_n": 5,
    "race_items": [
      "time_remaining",
      "laps_completed",
      "fastest_lap",
      "last_lap",
      "resets"
    ]
  }
}
```

- [ ] **Step 2: Create `README.md`**

Write a README covering:
1. Hardware requirements (Pico W + Pimoroni Galactic Unicorn, Pimoroni firmware link)
2. Getting the config — point to the DREM admin portal Pico LED Display page
3. Installing (Thonny or `rshell`): copy all `.py` files + `config.json` to the root of the Pico
4. Troubleshooting: error messages and their meanings (`CONFIG ERROR`, `NO WIFI`, `RECONNECTING...`)
5. `race_items` reference table (valid values and what they display)

- [ ] **Step 3: Commit**

```bash
git add pico-display/config.json.example pico-display/README.md
git commit -m "docs(pico): example config and hardware setup README"
```

---

## Task 11: Run all tests and verify

- [ ] **Step 1: Run full test suite**

```bash
cd pico-display && python -m pytest -v
```
Expected: all tests pass (test_config, test_display, test_leaderboard, test_race)

- [ ] **Step 2: Verify `.gitignore` excludes `config.json` but not `config.json.example`**

```bash
git status pico-display/
```
`config.json` must not appear; `config.json.example` must be tracked.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(pico): complete MicroPython Galactic Unicorn display app"
```
