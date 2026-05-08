"""Tests for avatar.py — the avataaars JSON → SVG bridge."""
import sys
import types

import pytest

import avatar


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
    assert avatar._to_screaming_snake("WinterHat2") == "WINTER_HAT2"


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
    fake_module.AvatarStyle = types.SimpleNamespace(Transparent="TRANSPARENT")
    for cls_name in [
        "TopType", "AccessoriesType", "HairColor", "FacialHairType",
        "FacialHairColor", "ClotheType", "ClotheColor", "EyeType",
        "EyebrowType", "MouthType", "SkinColor",
    ]:
        setattr(fake_module, cls_name, FakeEnumClass)

    monkeypatch.setitem(sys.modules, "py_avataaars", fake_module)

    out = avatar.render_avatar_svg({
        "topType": "ShortHairShortFlat",
        "skinColor": "Pale",
        "hairColor": "Brown",
    })
    assert out == "<svg>fake</svg>"
    assert captured_kwargs["style"] == "TRANSPARENT"
    assert captured_kwargs["top_type"].name == "SHORT_HAIR_SHORT_FLAT"
    assert captured_kwargs["skin_color"].name == "PALE"
    assert captured_kwargs["hair_color"].name == "BROWN"


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
    fake_module.AvatarStyle = types.SimpleNamespace(Transparent="T")
    for cls_name in [
        "TopType", "AccessoriesType", "HairColor", "FacialHairType",
        "FacialHairColor", "ClotheType", "ClotheColor", "EyeType",
        "EyebrowType", "MouthType", "SkinColor",
    ]:
        setattr(fake_module, cls_name, FakeEnumClass)
    monkeypatch.setitem(sys.modules, "py_avataaars", fake_module)

    out = avatar.render_avatar_svg('{"topType": "ShortHair", "skinColor": "Light"}')
    assert out == "<svg>parsed</svg>"
