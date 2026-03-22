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
