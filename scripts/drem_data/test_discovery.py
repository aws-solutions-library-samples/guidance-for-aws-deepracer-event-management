"""Tests for discovery module."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from drem_data.discovery import parse_build_config, parse_cfn_outputs


class TestParseBuildConfig:
    def test_parses_key_value_pairs(self, tmp_path):
        config = tmp_path / "build.config"
        config.write_text("region=eu-west-1\nlabel=main\nemail=test@example.com\n")
        result = parse_build_config(str(config))
        assert result["region"] == "eu-west-1"
        assert result["label"] == "main"
        assert result["email"] == "test@example.com"

    def test_ignores_blank_lines(self, tmp_path):
        config = tmp_path / "build.config"
        config.write_text("region=eu-west-1\n\nlabel=main\n")
        result = parse_build_config(str(config))
        assert result["region"] == "eu-west-1"
        assert result["label"] == "main"

    def test_missing_file_returns_empty(self, tmp_path):
        result = parse_build_config(str(tmp_path / "nonexistent"))
        assert result == {}


class TestParseCfnOutputs:
    def test_parses_outputs_array(self, tmp_path):
        outputs = [
            {"OutputKey": "userPoolId", "OutputValue": "eu-west-1_ABC123"},
            {"OutputKey": "region", "OutputValue": "eu-west-1"},
            {"OutputKey": "appsyncId", "OutputValue": "xyz"},
        ]
        path = tmp_path / "cfn.outputs"
        path.write_text(json.dumps(outputs))
        result = parse_cfn_outputs(str(path))
        assert result["userPoolId"] == "eu-west-1_ABC123"
        assert result["region"] == "eu-west-1"

    def test_missing_file_returns_empty(self, tmp_path):
        result = parse_cfn_outputs(str(tmp_path / "nonexistent"))
        assert result == {}
