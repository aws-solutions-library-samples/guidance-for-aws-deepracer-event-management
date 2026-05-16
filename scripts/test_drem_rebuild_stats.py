"""Tests for drem_rebuild_stats.find_stats_lambda."""
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))
from drem_rebuild_stats import find_stats_lambda


def _mock_cfn_client(stack_to_resources: dict[str, list[dict]]) -> MagicMock:
    """
    Mock boto3 CFN client whose paginator returns the given resources for
    each stack. Mirrors the helper in drem_data/test_discovery.py — kept
    local here so this test file can run independently of that one.
    """
    client = MagicMock()

    def get_paginator(_name):
        paginator = MagicMock()

        def paginate(StackName):
            return iter([{"StackResourceSummaries": stack_to_resources.get(StackName, [])}])

        paginator.paginate.side_effect = paginate
        return paginator

    client.get_paginator.side_effect = get_paginator
    return client


class TestFindStatsLambda:
    def test_finds_lambda_inside_nested_stack(self):
        # Post-#216 world: Statistics construct is in a NestedStack and the
        # Lambda's logical ID is bare `evbLambdaXXX` (no construct prefix).
        stacks = {
            "drem-backend-main-infrastructure": [
                {"ResourceType": "AWS::CloudFormation::Stack", "LogicalResourceId": "StatisticsNestedStack", "PhysicalResourceId": "stats-nested"},
            ],
            "stats-nested": [
                {"ResourceType": "AWS::Lambda::Function", "LogicalResourceId": "evbLambdaABC123", "PhysicalResourceId": "actual-fn-arn"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            result = find_stats_lambda("drem-backend-main-infrastructure", "eu-west-1")
        assert result == "actual-fn-arn"

    def test_finds_lambda_in_parent_stack_legacy_form(self):
        # Pre-#216 world: Statistics was a plain Construct, Lambda logical
        # ID had the `StatisticsevbLambda` construct-prefix. Both forms must
        # keep working so the script handles mixed deployments.
        stacks = {
            "parent": [
                {"ResourceType": "AWS::Lambda::Function", "LogicalResourceId": "StatisticsevbLambdaABC", "PhysicalResourceId": "legacy-fn-arn"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            result = find_stats_lambda("parent", "eu-west-1")
        assert result == "legacy-fn-arn"

    def test_returns_none_when_not_present(self):
        stacks = {
            "parent": [
                {"ResourceType": "AWS::DynamoDB::Table", "LogicalResourceId": "RaceManagerTable", "PhysicalResourceId": "race-1"},
            ],
        }
        with patch("drem_data.discovery.boto3.client", return_value=_mock_cfn_client(stacks)):
            result = find_stats_lambda("parent", "eu-west-1")
        assert result is None
