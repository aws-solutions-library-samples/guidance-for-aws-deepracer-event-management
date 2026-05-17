"""Tests for avatar.py — the avataaars JSON → PNG-data-URI bridge."""
import base64
import sys
import types

import pytest

import avatar

# Detect whether the real py_avataaars package is available — if so the smoke
# test at the bottom uses it. The Lambda image always has it; local dev may
# or may not.
try:
    import py_avataaars  # type: ignore[import-not-found]  # noqa: F401
    _PY_AVATAAARS_AVAILABLE = True
except ImportError:
    _PY_AVATAAARS_AVAILABLE = False


def test_returns_none_for_falsy():
    assert avatar.render_avatar_data_uri(None) is None
    assert avatar.render_avatar_data_uri("") is None
    assert avatar.render_avatar_data_uri({}) is None


def test_returns_none_for_invalid_json_string():
    assert avatar.render_avatar_data_uri("not json {{{") is None


def test_returns_none_for_non_dict():
    assert avatar.render_avatar_data_uri([1, 2, 3]) is None
    assert avatar.render_avatar_data_uri(42) is None


def test_to_screaming_snake_basic():
    assert avatar._to_screaming_snake("ShortHairShortFlat") == "SHORT_HAIR_SHORT_FLAT"
    assert avatar._to_screaming_snake("Pale") == "PALE"


def test_to_screaming_snake_single_digit_suffix_has_no_separator():
    """py-avataaars uses WINTER_HAT1, LONG_HAIR_STRAIGHT2 (no underscore
    before single digits) — our converter must match."""
    assert avatar._to_screaming_snake("WinterHat1") == "WINTER_HAT1"
    assert avatar._to_screaming_snake("WinterHat2") == "WINTER_HAT2"
    assert avatar._to_screaming_snake("LongHairStraight2") == "LONG_HAIR_STRAIGHT2"


def test_to_screaming_snake_two_digit_suffix_inserts_separator():
    """py-avataaars uses PRESCRIPTION_01, BLUE_01, SHORT_HAIR_DREADS_01
    (underscore before two-digit suffixes) — without this rule, accessories
    like sunglasses-with-prescription and any color-01/02 variant silently
    fall back to defaults."""
    assert avatar._to_screaming_snake("Prescription01") == "PRESCRIPTION_01"
    assert avatar._to_screaming_snake("Prescription02") == "PRESCRIPTION_02"
    assert avatar._to_screaming_snake("Blue01") == "BLUE_01"
    assert avatar._to_screaming_snake("Blue02") == "BLUE_02"
    assert avatar._to_screaming_snake("Gray01") == "GRAY_01"
    assert avatar._to_screaming_snake("ShortHairDreads01") == "SHORT_HAIR_DREADS_01"


def test_returns_none_when_py_avataaars_missing(monkeypatch):
    """If py_avataaars isn't importable, the function should return None gracefully
    so the templates fall back to the silhouette / no-avatar path."""
    monkeypatch.setitem(sys.modules, "py_avataaars", None)
    assert avatar.render_avatar_data_uri({"topType": "ShortHairShortFlat"}) is None


def _make_fake_py_avataaars(captured_kwargs, png_bytes=b"\x89PNG\r\n\x1a\nfake"):
    """Build a stub py_avataaars module that records constructor kwargs and
    returns canned PNG bytes from render_png()."""
    class FakeEnum:
        def __init__(self, name):
            self.name = name

    class FakeEnumClass:
        def __class_getitem__(cls, key):
            return FakeEnum(key)

    class FakePyAvataaar:
        def __init__(self, **kwargs):
            captured_kwargs.update(kwargs)

        def render_png(self):
            return png_bytes

    module = types.ModuleType("py_avataaars")
    module.PyAvataaar = FakePyAvataaar
    module.AvatarStyle = types.SimpleNamespace(TRANSPARENT="TRANSPARENT")
    for cls_name in [
        "TopType", "AccessoriesType", "HairColor", "FacialHairType",
        "ClotheType", "Color", "EyesType",
        "EyebrowType", "MouthType", "SkinColor",
    ]:
        setattr(module, cls_name, FakeEnumClass)
    return module


def test_passes_correct_enums_and_returns_data_uri(monkeypatch):
    """When py_avataaars is present, the function should pass mapped enums to
    PyAvataaar(...) and base64-encode render_png() into a data URI."""
    captured_kwargs = {}
    fake = _make_fake_py_avataaars(captured_kwargs, png_bytes=b"\x89PNG_payload")
    monkeypatch.setitem(sys.modules, "py_avataaars", fake)

    out = avatar.render_avatar_data_uri({
        "topType": "ShortHairShortFlat",
        "skinColor": "Pale",
        "hairColor": "Brown",
        "eyeType": "Happy",
        "clotheColor": "Blue01",
        "facialHairType": "BeardLight",
        "facialHairColor": "Black",
    })
    expected = "data:image/png;base64," + base64.b64encode(b"\x89PNG_payload").decode("ascii")
    assert out == expected
    assert captured_kwargs["style"] == "TRANSPARENT"
    assert captured_kwargs["top_type"].name == "SHORT_HAIR_SHORT_FLAT"
    assert captured_kwargs["skin_color"].name == "PALE"
    assert captured_kwargs["hair_color"].name == "BROWN"
    # These three were silently dropped before — eye_type was looking up a
    # non-existent EyeType class, clothe_color was looking up ClotheColor,
    # and facial_hair_color was looking up FacialHairColor.
    assert captured_kwargs["eye_type"].name == "HAPPY"
    assert captured_kwargs["clothe_color"].name == "BLUE_01"
    assert captured_kwargs["facial_hair_color"].name == "BLACK"


def test_accepts_json_string(monkeypatch):
    """AppSync sometimes returns AWSJSON as a string — accept it and parse."""
    captured_kwargs = {}
    fake = _make_fake_py_avataaars(captured_kwargs)
    monkeypatch.setitem(sys.modules, "py_avataaars", fake)

    out = avatar.render_avatar_data_uri('{"topType": "ShortHair", "skinColor": "Light"}')
    assert out is not None
    assert out.startswith("data:image/png;base64,")


@pytest.mark.skipif(not _PY_AVATAAARS_AVAILABLE, reason="py-avataaars not installed")
def test_real_library_smoke():
    """End-to-end render against the actual py-avataaars library.

    Uses values that exercise the previously-broken paths: `eyeType`
    (EyesType, not EyeType), `clotheColor` (Color, not ClotheColor),
    `facialHairColor` (HairColor, not FacialHairColor), and a two-digit
    suffix value (`Blue01` → `BLUE_01`). The stubbed tests above can't
    see drift between our enum class names and py-avataaars's; this test
    can. The Lambda container ships py-avataaars so this path always
    runs in CI.
    """
    config = {
        "topType": "ShortHairShortFlat",
        "accessoriesType": "Prescription01",
        "hairColor": "Brown",
        "facialHairType": "BeardLight",
        "facialHairColor": "BrownDark",
        "clotheType": "Hoodie",
        "clotheColor": "Blue01",
        "eyeType": "Happy",
        "eyebrowType": "Default",
        "mouthType": "Smile",
        "skinColor": "Light",
    }
    out = avatar.render_avatar_data_uri(config)
    assert out is not None, "real py-avataaars should produce a data URI for a valid config"
    assert out.startswith("data:image/png;base64,"), \
        f"output should be a PNG data URI, got: {out[:80]!r}"
    # Confirm the payload decodes to a real PNG (8-byte signature).
    payload = base64.b64decode(out.split(",", 1)[1])
    assert payload[:8] == b"\x89PNG\r\n\x1a\n", "decoded payload is not a PNG"
