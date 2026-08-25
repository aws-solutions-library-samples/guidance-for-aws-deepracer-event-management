#!/usr/bin/env python3
"""
One-time migration script to backfill preferred_username and custom:racerName
for existing Cognito users.

For each user:
- Sets preferred_username = Username if not already set (for login/uniqueness)
- Sets custom:racerName = Username if not already set (case-preserving display name)

Usage:
    python scripts/backfill_preferred_username.py --user-pool-id <USER_POOL_ID> [--dry-run]
"""

import argparse
import sys

import boto3


def get_all_users(client, user_pool_id):
    """Paginate through all users in the pool."""
    paginator = client.get_paginator("list_users")
    for page in paginator.paginate(
        UserPoolId=user_pool_id, PaginationConfig={"PageSize": 60}
    ):
        yield from page["Users"]


def get_attribute(user, attr_name):
    """Extract an attribute value from a user's Attributes list."""
    for attr in user.get("Attributes", []):
        if attr["Name"] == attr_name:
            return attr["Value"]
    return None


def backfill(user_pool_id, dry_run=False):
    client = boto3.client("cognito-idp")

    updated = 0
    skipped = 0
    errors = 0

    for user in get_all_users(client, user_pool_id):
        username = user["Username"]
        preferred = get_attribute(user, "preferred_username")
        racer_name = get_attribute(user, "custom:racerName")

        if preferred and racer_name:
            skipped += 1
            continue

        attrs_to_set = []
        if not preferred:
            attrs_to_set.append({"Name": "preferred_username", "Value": username})
        if not racer_name:
            # Use the original Username (case-preserving) for display
            attrs_to_set.append({"Name": "custom:racerName", "Value": username})

        if dry_run:
            attr_names = ", ".join(a["Name"] for a in attrs_to_set)
            print(
                f"[DRY RUN] Would set {attr_names}='{username}' for user '{username}'"
            )
            updated += 1
            continue

        try:
            client.admin_update_user_attributes(
                UserPoolId=user_pool_id,
                Username=username,
                UserAttributes=attrs_to_set,
            )
            attr_names = ", ".join(a["Name"] for a in attrs_to_set)
            print(f"Set {attr_names}='{username}' for user '{username}'")
            updated += 1
        except Exception as e:
            print(f"ERROR updating user '{username}': {e}", file=sys.stderr)
            errors += 1

    print(
        f"\nDone. Updated: {updated}, Skipped (already set): {skipped}, Errors: {errors}"
    )
    if dry_run:
        print("(Dry run — no changes were made)")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill preferred_username and custom:racerName for existing Cognito users"
    )
    parser.add_argument("--user-pool-id", required=True, help="Cognito User Pool ID")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without making changes",
    )
    args = parser.parse_args()
    backfill(args.user_pool_id, args.dry_run)


if __name__ == "__main__":
    main()
