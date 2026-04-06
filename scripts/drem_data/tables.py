"""
DynamoDB table helpers — scan, write, Decimal conversion, userId remapping.
"""
from decimal import Decimal

import boto3


def to_decimal(obj):
    """Convert floats to Decimal for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(i) for i in obj]
    return obj


def from_decimal(obj):
    """Convert Decimals back to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj == int(obj):
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: from_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [from_decimal(i) for i in obj]
    return obj


def scan_table(table_name: str, region: str) -> list[dict]:
    """Paginated full scan of a DynamoDB table. Returns all items with Decimals converted."""
    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    items = []
    response = table.scan()
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response["Items"])
    return [from_decimal(item) for item in items]


def batch_write_items(table_name: str, region: str, items: list[dict], dry_run: bool = False) -> int:
    """Write items to a DynamoDB table using batch_writer. Returns count written."""
    if dry_run:
        for item in items:
            pk_field = next((k for k in ["eventId", "fleetId", "pk"] if k in item), "?")
            print(f"  [DRY] PUT {pk_field}={item.get(pk_field, '?')}")
        return len(items)

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    count = 0
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=to_decimal(item))
            count += 1
    return count


def remap_user_id_in_race(item: dict, mapping: dict) -> dict:
    """Remap userId and sk in a race item. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("userId", "")
    new_sub = mapping.get(old_sub, old_sub)
    item["userId"] = new_sub
    if "sk" in item and old_sub:
        item["sk"] = item["sk"].replace(old_sub, new_sub)
    return item


def remap_user_id_in_leaderboard(item: dict, mapping: dict) -> dict:
    """Remap userId and sk in a leaderboard item. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("userId", "")
    new_sub = mapping.get(old_sub, old_sub)
    item["userId"] = new_sub
    if "sk" in item and old_sub:
        item["sk"] = item["sk"].replace(old_sub, new_sub)
    return item


def remap_created_by(item: dict, mapping: dict) -> dict:
    """Remap createdBy field. Returns a new dict."""
    item = dict(item)
    old_sub = item.get("createdBy", "")
    item["createdBy"] = mapping.get(old_sub, old_sub)
    return item
