"""Render an avataaars JSON config to SVG for embedding in PDF templates.

The avatar JSON in the RacerProfile table uses the React `avataaars` library's
key/value vocabulary (camelCase + UpperCamel values like `ShortHairShortFlat`).
`py-avataaars` is a Python port that takes the same shape but as Python enums
named in SCREAMING_SNAKE_CASE. This module bridges the two.

Anything unmappable returns None and the caller falls back to the silhouette.
"""
import json
import re
from typing import Optional

from aws_lambda_powertools import Logger

logger = Logger()

# Config-key → (py-avataaars enum class name, constructor arg name).
_ENUM_FIELDS = [
    ("topType", "TopType", "top_type"),
    ("accessoriesType", "AccessoriesType", "accessories_type"),
    ("hairColor", "HairColor", "hair_color"),
    ("facialHairType", "FacialHairType", "facial_hair_type"),
    ("facialHairColor", "FacialHairColor", "facial_hair_color"),
    ("clotheType", "ClotheType", "clothe_type"),
    ("clotheColor", "ClotheColor", "clothe_color"),
    ("eyeType", "EyeType", "eye_type"),
    ("eyebrowType", "EyebrowType", "eyebrow_type"),
    ("mouthType", "MouthType", "mouth_type"),
    ("skinColor", "SkinColor", "skin_color"),
]


def _to_screaming_snake(camel: str) -> str:
    """ShortHairShortFlat → SHORT_HAIR_SHORT_FLAT."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", camel).upper()


def render_avatar_svg(config) -> Optional[str]:
    """Convert an avataaars JSON config into an SVG string.

    Accepts a dict, a JSON string, or None. Returns None on any failure so
    callers can fall back to a silhouette without special-casing.
    """
    if not config:
        return None
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except (json.JSONDecodeError, ValueError):
            logger.warning("avatar config not valid JSON")
            return None
    if not isinstance(config, dict):
        return None

    try:
        import py_avataaars  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("py-avataaars not installed; skipping avatar render")
        return None

    # py-avataaars 1.1.2's AvatarStyle uses SCREAMING_SNAKE values (TRANSPARENT,
    # CIRCLE) — the README's mixed-case examples are out of date.
    kwargs = {"style": py_avataaars.AvatarStyle.TRANSPARENT}
    for json_key, enum_name, arg_name in _ENUM_FIELDS:
        val = config.get(json_key)
        if not val or not isinstance(val, str):
            continue
        enum_cls = getattr(py_avataaars, enum_name, None)
        if enum_cls is None:
            continue
        try:
            kwargs[arg_name] = enum_cls[_to_screaming_snake(val)]
        except KeyError:
            # Value not supported by py-avataaars (e.g. newer hat type) —
            # let the constructor use its default for this slot.
            logger.debug(f"avatar field {json_key}={val!r} not in py-avataaars enum")
            continue

    try:
        return py_avataaars.PyAvataaar(**kwargs).render_svg()
    except Exception:
        logger.exception("py-avataaars render failed")
        return None
