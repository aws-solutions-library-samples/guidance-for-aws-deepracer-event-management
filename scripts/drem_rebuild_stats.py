#!/usr/bin/env python3
"""
drem_rebuild_stats.py — Invoke the Stats EVB Lambda to rebuild global statistics.

Useful after importing data via drem_import.py, since direct DynamoDB writes
bypass EventBridge and don't trigger the stats Lambda automatically.

Usage:
    python scripts/drem_rebuild_stats.py                # rebuild stats
    python scripts/drem_rebuild_stats.py --stack dev    # target different env
"""
import argparse
import json
import os
import sys

import boto3

sys.path.insert(0, os.path.dirname(__file__))
from drem_data.discovery import discover_config


LAMBDA_LOGICAL_PREFIX = "StatisticsevbLambda"


def find_stats_lambda(stack_name: str, region: str) -> str | None:
    """Find the Stats EVB Lambda function name from CloudFormation."""
    cf = boto3.client("cloudformation", region_name=region)
    try:
        paginator = cf.get_paginator("list_stack_resources")
        for page in paginator.paginate(StackName=stack_name):
            for r in page["StackResourceSummaries"]:
                if (r["ResourceType"] == "AWS::Lambda::Function"
                        and r["LogicalResourceId"].startswith(LAMBDA_LOGICAL_PREFIX)):
                    return r["PhysicalResourceId"]
    except Exception as e:
        print(f"ERROR: Could not discover Lambda: {e}")
    return None


def main():
    parser = argparse.ArgumentParser(description="Rebuild DREM global statistics")
    parser.add_argument("--stack", help="Override stack label from build.config")
    args = parser.parse_args()

    config = discover_config(stack_override=args.stack)

    # Find the stats EVB Lambda
    fn_name = find_stats_lambda(config["stack_name"], config["region"])
    if not fn_name:
        sys.exit("ERROR: Stats EVB Lambda not found. Is the Statistics construct deployed?")

    print(f"Stats Lambda: {fn_name}")
    print()

    # Build a synthetic EventBridge event to trigger a rebuild.
    # The Lambda's _handle_upsert looks up the event first, then calls
    # _rebuild_global_stats(). We need a real eventId that exists in
    # the events table, so we grab the first one.
    tables = config["tables"]
    if "events" not in tables:
        sys.exit("ERROR: Events table not found. Run discovery first.")

    print("Finding an event to trigger rebuild...")
    ddb = boto3.resource("dynamodb", region_name=config["region"])
    events_table = ddb.Table(tables["events"])
    scan = events_table.scan(Limit=1)
    if not scan.get("Items"):
        sys.exit("ERROR: Events table is empty. Import data first.")

    event = scan["Items"][0]
    event_id = event["eventId"]
    print(f"  Using event: {event.get('eventName', event_id)}\n")

    payload = {
        "detail-type": "raceSummaryAdded",
        "detail": {
            "eventId": event_id,
            "userId": "stats-rebuild-trigger",
            "trackId": "1",
        },
    }

    print("Invoking stats rebuild...")
    lambda_client = boto3.client("lambda", region_name=config["region"])
    response = lambda_client.invoke(
        FunctionName=fn_name,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload),
    )

    status_code = response["StatusCode"]
    response_payload = response["Payload"].read().decode()

    if status_code == 200 and "FunctionError" not in response:
        print(f"Stats rebuild complete (HTTP {status_code})")
        if response_payload and response_payload != "null":
            print(f"Response: {response_payload}")
    else:
        print(f"ERROR: Lambda returned {status_code}")
        if "FunctionError" in response:
            print(f"Function error: {response['FunctionError']}")
        print(f"Response: {response_payload}")
        sys.exit(1)


if __name__ == "__main__":
    main()
