"""Tests for DynamoDB table helpers."""
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from drem_data.tables import to_decimal, from_decimal, remap_user_id_in_race, remap_user_id_in_leaderboard


class TestDecimalConversion:
    def test_float_to_decimal(self):
        assert to_decimal(3.14) == Decimal("3.14")

    def test_nested_dict(self):
        result = to_decimal({"time": 7234.5, "name": "test"})
        assert result == {"time": Decimal("7234.5"), "name": "test"}

    def test_nested_list(self):
        result = to_decimal([1.5, 2.5])
        assert result == [Decimal("1.5"), Decimal("2.5")]

    def test_int_unchanged(self):
        assert to_decimal(42) == 42

    def test_none_unchanged(self):
        assert to_decimal(None) is None

    def test_from_decimal(self):
        result = from_decimal({"time": Decimal("7234.5"), "count": Decimal("3")})
        assert result == {"time": 7234.5, "count": 3}

    def test_from_decimal_int_detection(self):
        result = from_decimal(Decimal("42"))
        assert result == 42
        assert isinstance(result, int)


class TestUserIdRemap:
    def test_remap_race_item(self):
        mapping = {"old-sub": "new-sub"}
        item = {
            "eventId": "evt-1",
            "sk": "TRACK#track-1#USER#old-sub#RACE#race-1",
            "userId": "old-sub",
            "type": "race",
        }
        result = remap_user_id_in_race(item, mapping)
        assert result["userId"] == "new-sub"
        assert "USER#new-sub" in result["sk"]
        assert "old-sub" not in result["sk"]

    def test_remap_race_item_no_mapping(self):
        mapping = {}
        item = {
            "eventId": "evt-1",
            "sk": "TRACK#track-1#USER#some-sub#RACE#race-1",
            "userId": "some-sub",
            "type": "race",
        }
        result = remap_user_id_in_race(item, mapping)
        assert result["userId"] == "some-sub"

    def test_remap_leaderboard_item(self):
        mapping = {"old-sub": "new-sub"}
        item = {
            "eventId": "evt-1",
            "sk": "track-1#old-sub",
            "userId": "old-sub",
            "username": "alice",
        }
        result = remap_user_id_in_leaderboard(item, mapping)
        assert result["userId"] == "new-sub"
        assert result["sk"] == "track-1#new-sub"
