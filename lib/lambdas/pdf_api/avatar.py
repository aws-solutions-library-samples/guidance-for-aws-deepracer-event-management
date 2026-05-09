"""Render an avataaars JSON config to a PNG data URI for PDF templates.

The avatar JSON in the RacerProfile table uses the React `avataaars` library's
key/value vocabulary (camelCase + UpperCamel values like `ShortHairShortFlat`).
`py-avataaars` is a Python port that takes the same shape but as Python enums
named in SCREAMING_SNAKE_CASE. This module bridges the two.

We render to PNG (via py-avataaars's CairoSVG-backed render_png) rather than
inline SVG: avataaars composes the figure with heavy use of <mask> + <clipPath>,
and WeasyPrint 62.3's SVG renderer renders those incorrectly — skin layers
disappear and underlying hair-colour fills bleed through, producing a
brown-blob-with-sunglasses instead of the actual avatar. Cairo handles the
masks correctly, so a Cairo-rasterised PNG embedded as a data URI sidesteps
the WeasyPrint SVG limitation entirely.

Anything unmappable returns None and the caller falls back to the silhouette.
"""
import base64
import json
import re
from typing import Optional

from aws_lambda_powertools import Logger

logger = Logger()

# Config-key → (py-avataaars enum class name, constructor arg name). The class
# names don't always match the React avataaars vocabulary one-for-one:
#   - eye uses `EyesType` (note the S)
#   - both clothe colour and hat colour share a single `Color` enum
#   - facial hair colour reuses the `HairColor` enum
_ENUM_FIELDS = [
    ("topType", "TopType", "top_type"),
    ("accessoriesType", "AccessoriesType", "accessories_type"),
    ("hairColor", "HairColor", "hair_color"),
    ("facialHairType", "FacialHairType", "facial_hair_type"),
    ("facialHairColor", "HairColor", "facial_hair_color"),
    ("clotheType", "ClotheType", "clothe_type"),
    ("clotheColor", "Color", "clothe_color"),
    ("eyeType", "EyesType", "eye_type"),
    ("eyebrowType", "EyebrowType", "eyebrow_type"),
    ("mouthType", "MouthType", "mouth_type"),
    ("skinColor", "SkinColor", "skin_color"),
]


def _to_screaming_snake(camel: str) -> str:
    """ShortHairShortFlat → SHORT_HAIR_SHORT_FLAT.

    Two-digit numeric suffixes get an underscore separator so React values like
    `Prescription01`, `Blue01`, `ShortHairDreads01` map to py-avataaars's
    `PRESCRIPTION_01`, `BLUE_01`, `SHORT_HAIR_DREADS_01`. Single-digit suffixes
    don't get a separator (`WinterHat1` → `WINTER_HAT1`,
    `LongHairStraight2` → `LONG_HAIR_STRAIGHT2`) — py-avataaars is inconsistent
    here and we follow what the actual enum members are named.
    """
    out = re.sub(r"(?<!^)(?=[A-Z])", "_", camel)
    out = re.sub(r"(?<=[A-Za-z])(?=\d{2,})", "_", out)
    return out.upper()


def render_avatar_data_uri(config) -> Optional[str]:
    """Convert an avataaars JSON config into a `data:image/png;base64,…` URI.

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
        png_bytes = py_avataaars.PyAvataaar(**kwargs).render_png()
    except Exception:
        logger.exception("py-avataaars render failed")
        return None
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")
