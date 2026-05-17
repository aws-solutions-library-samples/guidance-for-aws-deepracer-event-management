"""Tests for discovery module."""
import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from drem_data.discovery import (
    discover_tables,
    iter_stack_resources,
    parse_build_config,
    parse_cfn_outputs,
)


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


def _mock_cfn_client(stack_to_resources: dict[str, list[dict]]) -> MagicMock:
    """
    Build a mock boto3 CloudFormation client that returns the given resources
    per stack. The paginator's `paginate(StackName=...)` is wired to return a
    single page with the resources for that stack.
    """
    client = MagicMock()

    def get_paginator(_name):
        paginator = MagicMock()

        def paginate(StackName):
            resources = stack_to_resources.get(StackName, [])
            return iter([{"StackResourceSummaries": resources}])

        paginator.paginate.side_effect = paginate
        return paginator

    client.get_paginator.side_effect = get_paginator
    return client


class TestIterStackResources:
    def test_yields_top_level_resources(self):
        stacks = {
            "parent": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "EventsTable", "PhysicalResourceId": "events-1"},
                {"ResourceType": "AWS::Lambda::Function", "LogicalResourceId": "Fn", "PhysicalResourceId": "fn-1"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            ids = [r["LogicalResourceId"] for r in iter_stack_resources("parent", "eu-west-1")]
        assert ids == ["EventsTable", "Fn"]

    def test_recurses_into_nested_stacks(self):
        # The parent stack has one regular resource and one nested-stack
        # placeholder pointing at "child-stack". Iteration should yield both
        # the placeholder and the child's resources.
        stacks = {
            "parent": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "EventsTable", "PhysicalResourceId": "events-1"},
                {"ResourceType": "AWS::CloudFormation::Stack", "LogicalResourceId": "Nested", "PhysicalResourceId": "child-stack"},
            ],
            "child-stack": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "StatsTable", "PhysicalResourceId": "stats-1"},
                {"ResourceType": "AWS::Lambda::Function", "LogicalResourceId": "evbLambda", "PhysicalResourceId": "lambda-1"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            ids = [r["LogicalResourceId"] for r in iter_stack_resources("parent", "eu-west-1")]
        assert ids == ["EventsTable", "Nested", "StatsTable", "evbLambda"]

    def test_recurses_multiple_levels(self):
        # Defensive: a nested stack inside a nested stack should still be
        # walked. Unlikely in DREM today but cheap to assert.
        stacks = {
            "L0": [{"ResourceType": "AWS::CloudFormation::Stack", "LogicalResourceId": "L1", "PhysicalResourceId": "L1"}],
            "L1": [{"ResourceType": "AWS::CloudFormation::Stack", "LogicalResourceId": "L2", "PhysicalResourceId": "L2"}],
            "L2": [{"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "DeepTable", "PhysicalResourceId": "deep-1"}],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            ids = [r["LogicalResourceId"] for r in iter_stack_resources("L0", "eu-west-1")]
        assert ids == ["L1", "L2", "DeepTable"]


class TestDiscoverTables:
    def test_finds_table_in_nested_stack(self):
        # The whole point of the fix: StatsTable now lives in the Statistics
        # NestedStack with a bare logical ID. discover_tables must still find
        # it and map it to "stats".
        stacks = {
            "parent": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "EventsManagerEventsTable123", "PhysicalResourceId": "events-1"},
                {"ResourceType": "AWS::CloudFormation::Stack", "LogicalResourceId": "Statistics", "PhysicalResourceId": "stats-nested"},
            ],
            "stats-nested": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "StatsTableABC", "PhysicalResourceId": "stats-physical"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            tables = discover_tables("parent", "eu-west-1")
        assert tables == {"events": "events-1", "stats": "stats-physical"}

    def test_still_finds_parent_stack_tables(self):
        # Regression guard: non-nested tables must keep working.
        stacks = {
            "parent": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "RaceManagerTable999", "PhysicalResourceId": "race-1"},
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "FleetsManagerFleetsTable888", "PhysicalResourceId": "fleets-1"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            tables = discover_tables("parent", "eu-west-1")
        assert tables == {"race": "race-1", "fleets": "fleets-1"}
