"""
Discover DREM infrastructure — table names, user pool, region.
Reads build.config and cfn.outputs, queries CloudFormation for DynamoDB tables.
"""
import json
import os

import boto3

TABLE_LOGICAL_ID_MAP = {
    "RaceManagerTable": "race",
    "EventsManagerEventsTable": "events",
    "LeaderboardTable": "leaderboard",
    "FleetsManagerFleetsTable": "fleets",
    "LandingPageManagerlandingPageConfigsTable": "landing_pages",
    # The stats table moved into a NestedStack (#216) — inside the nested
    # template the construct-prefix is dropped and the logical ID becomes
    # bare `StatsTable...`. Keep both forms so discovery works on stacks
    # before and after the migration.
    "StatisticsStatsTable": "stats",
    "StatsTable": "stats",
    "RacerProfileRacerProfileTable": "racer_profile",
}


def iter_stack_resources(stack_name: str, region: str):
    """
    Yield resource summaries from `stack_name`, recursing into any nested
    stacks. Required since #216 wrapped `Statistics` and `RaceResultsPdf`
    in `NestedStack` — `list_stack_resources` on the parent only returns
    the `AWS::CloudFormation::Stack` placeholder, not the resources inside.
    """
    cf = boto3.client("cloudformation", region_name=region)
    paginator = cf.get_paginator("list_stack_resources")
    for page in paginator.paginate(StackName=stack_name):
        for r in page["StackResourceSummaries"]:
            yield r
            if r["ResourceType"] == "AWS::CloudFormation::Stack":
                nested_name = r.get("PhysicalResourceId")
                if nested_name:
                    yield from iter_stack_resources(nested_name, region)


def parse_build_config(path: str = "build.config") -> dict:
    """Parse build.config key=value file."""
    result = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if "=" in line:
                    key, value = line.split("=", 1)
                    result[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return result


def parse_cfn_outputs(path: str = "cfn.outputs") -> dict:
    """Parse cfn.outputs JSON array into a flat dict."""
    result = {}
    try:
        with open(path) as f:
            data = json.load(f)
        for item in data:
            result[item["OutputKey"]] = item["OutputValue"]
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass
    return result


def discover_tables(stack_name: str, region: str) -> dict:
    """
    Find DynamoDB table physical names by listing CloudFormation stack resources
    (including those in nested stacks) and matching logical IDs against
    TABLE_LOGICAL_ID_MAP.

    Returns: {"race": "physical-table-name", "events": "...", ...}
    """
    tables = {}
    try:
        for r in iter_stack_resources(stack_name, region):
            if r["ResourceType"] != "AWS::DynamoDB::Table":
                continue
            logical_id = r["LogicalResourceId"]
            for prefix, friendly_name in TABLE_LOGICAL_ID_MAP.items():
                if logical_id.startswith(prefix):
                    tables[friendly_name] = r["PhysicalResourceId"]
                    break
    except Exception as e:
        print(f"WARNING: CloudFormation discovery failed: {e}")
    return tables


def discover_config(stack_override: str | None = None) -> dict:
    """
    Build a complete config dict from build.config, cfn.outputs, and CloudFormation.

    Returns:
        {
            "label": "main",
            "region": "eu-west-1",
            "stack_name": "drem-backend-main-infrastructure",
            "user_pool_id": "eu-west-1_ABC123",
            "tables": {"race": "...", "events": "...", ...},
        }
    """
    build = parse_build_config()
    cfn = parse_cfn_outputs()

    label = stack_override or build.get("label", "main")
    region = cfn.get("region") or build.get("region", "eu-west-1")
    stack_name = f"drem-backend-{label}-infrastructure"
    user_pool_id = cfn.get("userPoolId", "")

    print(f"Stack:       {stack_name}")
    print(f"Region:      {region}")
    print(f"User Pool:   {user_pool_id}")
    print()

    print("Discovering tables...")
    tables = discover_tables(stack_name, region)
    for friendly, physical in sorted(tables.items()):
        print(f"  {friendly:15}: {physical}")
    print()

    return {
        "label": label,
        "region": region,
        "stack_name": stack_name,
        "user_pool_id": user_pool_id,
        "tables": tables,
    }
