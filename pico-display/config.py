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
