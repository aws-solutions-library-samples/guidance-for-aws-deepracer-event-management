"""Tests for avatar.py — the avataaars JSON → SVG bridge."""
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


def test_render_avatar_svg_returns_none_for_falsy():
    assert avatar.render_avatar_svg(None) is None
    assert avatar.render_avatar_svg("") is None
    assert avatar.render_avatar_svg({}) is None


def test_render_avatar_svg_returns_none_for_invalid_json_string():
    assert avatar.render_avatar_svg("not json {{{") is None


def test_render_avatar_svg_returns_none_for_non_dict():
    assert avatar.render_avatar_svg([1, 2, 3]) is None
    assert avatar.render_avatar_svg(42) is None


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


def test_render_avatar_svg_returns_none_when_py_avataaars_missing(monkeypatch):
    """If py_avataaars isn't importable, the function should return None gracefully
    so the templates fall back to the silhouette / no-avatar path."""
    # Simulate the package being absent
    monkeypatch.setitem(sys.modules, "py_avataaars", None)
    assert avatar.render_avatar_svg({"topType": "ShortHairShortFlat"}) is None


def test_render_avatar_svg_with_stub_py_avataaars(monkeypatch):
    """When py_avataaars is present, the function should pass the mapped enums
    to PyAvataaar(...) and return the SVG string from .render_svg().

    We stub the package to avoid pulling in cairo/pillow native deps just for
    this test."""
    captured_kwargs = {}

    class FakeEnum:
        def __init__(self, name):
            self.name = name

        def __class_getitem__(cls, key):
            return FakeEnum(key)

        def __getitem__(self, key):
            return FakeEnum(key)

    class FakeEnumClass:
        def __class_getitem__(cls, key):
            return FakeEnum(key)

    class FakePyAvataaar:
        def __init__(self, **kwargs):
            captured_kwargs.update(kwargs)

        def render_svg(self):
            return "<svg>fake</svg>"

    fake_module = types.ModuleType("py_avataaars")
    fake_module.PyAvataaar = FakePyAvataaar
    fake_module.AvatarStyle = types.SimpleNamespace(TRANSPARENT="TRANSPARENT")
    for cls_name in [
        "TopType", "AccessoriesType", "HairColor", "FacialHairType",
        "ClotheType", "Color", "EyesType",
        "EyebrowType", "MouthType", "SkinColor",
    ]:
        setattr(fake_module, cls_name, FakeEnumClass)

    monkeypatch.setitem(sys.modules, "py_avataaars", fake_module)

    out = avatar.render_avatar_svg({
        "topType": "ShortHairShortFlat",
        "skinColor": "Pale",
        "hairColor": "Brown",
        "eyeType": "Happy",
        "clotheColor": "Blue01",
        "facialHairType": "BeardLight",
        "facialHairColor": "Black",
    })
    assert out == "<svg>fake</svg>"
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


def test_render_avatar_svg_accepts_json_string(monkeypatch):
    """AppSync sometimes returns AWSJSON as a string — accept it and parse."""
    class FakePyAvataaar:
        def __init__(self, **kwargs):
            pass

        def render_svg(self):
            return "<svg>parsed</svg>"

    class FakeEnumClass:
        def __class_getitem__(cls, key):
            return cls

    fake_module = types.ModuleType("py_avataaars")
    fake_module.PyAvataaar = FakePyAvataaar
    fake_module.AvatarStyle = types.SimpleNamespace(TRANSPARENT="T")
    for cls_name in [
        "TopType", "AccessoriesType", "HairColor", "FacialHairType",
        "ClotheType", "Color", "EyesType",
        "EyebrowType", "MouthType", "SkinColor",
    ]:
        setattr(fake_module, cls_name, FakeEnumClass)
    monkeypatch.setitem(sys.modules, "py_avataaars", fake_module)

    out = avatar.render_avatar_svg('{"topType": "ShortHair", "skinColor": "Light"}')
    assert out == "<svg>parsed</svg>"


@pytest.mark.skipif(not _PY_AVATAAARS_AVAILABLE, reason="py-avataaars not installed")
def test_render_avatar_svg_real_library_smoke():
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
    out = avatar.render_avatar_svg(config)
    assert out is not None, "real py-avataaars should produce SVG for a valid config"
    assert out.lstrip().startswith("<?xml") or out.lstrip().startswith("<svg"), \
        f"output should be SVG, got: {out[:80]!r}"
