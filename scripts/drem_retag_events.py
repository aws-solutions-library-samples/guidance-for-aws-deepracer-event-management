#!/usr/bin/env python3
"""
drem_retag_events.py — Bulk-update the typeOfEvent on events matching a name pattern.

Useful for retroactively classifying events. The classic case: events with
"test" in the name should be typeOfEvent=TEST_EVENT so the stats engine
excludes them (lib/lambdas/stats_evb/index.py:152).

Usage:
    # List candidates (default — no writes)
    python scripts/drem_retag_events.py \\
        --endpoint https://abc123.appsync-api.eu-west-1.amazonaws.com/graphql \\
        --token "$DREM_TOKEN" \\
        --filter test --to-type TEST_EVENT

    # Apply the change (with confirmation prompt)
    python scripts/drem_retag_events.py ... --filter test --to-type TEST_EVENT --apply

    # Skip confirmation
    python scripts/drem_retag_events.py ... --filter test --to-type TEST_EVENT --apply --yes

    # Only retag events that are currently a specific type
    python scripts/drem_retag_events.py ... --filter test --to-type TEST_EVENT --from-type OTHER --apply

Valid typeOfEvent values:
    PRIVATE_WORKSHOP, PRIVATE_TRACK_RACE, OFFICIAL_WORKSHOP, OFFICIAL_TRACK_RACE,
    AWS_SUMMIT, TEST_EVENT, OTHER
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from drem_data.api_client import DremApiClient


VALID_TYPES = {
    "PRIVATE_WORKSHOP",
    "PRIVATE_TRACK_RACE",
    "OFFICIAL_WORKSHOP",
    "OFFICIAL_TRACK_RACE",
    "AWS_SUMMIT",
    "TEST_EVENT",
    "OTHER",
}


def main():
    parser = argparse.ArgumentParser(description="Bulk-retag events by name pattern")
    parser.add_argument("--endpoint", required=True, help="AppSync GraphQL endpoint URL")
    token_group = parser.add_mutually_exclusive_group(required=True)
    token_group.add_argument("--token", help="Cognito JWT (admin or operator)")
    token_group.add_argument("--token-file", help="Path to a file containing the JWT (keeps it out of shell history)")
    parser.add_argument("--filter", required=True, help="Case-insensitive substring to match in event name")
    parser.add_argument("--to-type", required=True, help="Target typeOfEvent (e.g. TEST_EVENT)")
    parser.add_argument("--from-type", help="Only retag events currently of this typeOfEvent")
    parser.add_argument(
        "--exclude",
        help="Comma-separated substrings to exclude from the name match (case-insensitive)",
    )
    parser.add_argument("--apply", action="store_true", help="Actually update (default: dry-run, list only)")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt when --apply is set")
    args = parser.parse_args()

    if args.to_type not in VALID_TYPES:
        parser.error(f"--to-type must be one of {sorted(VALID_TYPES)}")
    if args.from_type and args.from_type not in VALID_TYPES:
        parser.error(f"--from-type must be one of {sorted(VALID_TYPES)}")

    if args.token_file:
        with open(args.token_file, "r") as f:
            token = f.read().strip()
    else:
        token = args.token

    client = DremApiClient(args.endpoint, token)
    events = client.get_events()

    needle = args.filter.lower()
    excludes = [s.strip().lower() for s in (args.exclude or "").split(",") if s.strip()]
    candidates = [
        e for e in events
        if needle in (e.get("eventName") or "").lower()
        and e.get("typeOfEvent") != args.to_type
        and (not args.from_type or e.get("typeOfEvent") == args.from_type)
        and not any(ex in (e.get("eventName") or "").lower() for ex in excludes)
    ]

    if not candidates:
        print(f"No events matched filter '{args.filter}' that need retagging to {args.to_type}.")
        return

    print(f"\nCandidates ({len(candidates)}):\n")
    print(f"  {'eventDate':<12} {'currentType':<22} → {args.to_type:<22} eventName")
    print(f"  {'-' * 12} {'-' * 22}   {'-' * 22} {'-' * 40}")
    for e in candidates:
        print(
            f"  {str(e.get('eventDate') or ''):<12} "
            f"{(e.get('typeOfEvent') or '-'):<22} → {args.to_type:<22} "
            f"{e.get('eventName') or ''}"
        )

    if not args.apply:
        print(f"\nDry-run only. Re-run with --apply to update {len(candidates)} event(s).")
        return

    if not args.yes:
        confirm = input(f"\nUpdate {len(candidates)} event(s) to {args.to_type}? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

    print()
    failures = 0
    for e in candidates:
        try:
            client.update_event({**e, "typeOfEvent": args.to_type})
            print(f"  ✓ {e['eventId']}  {e.get('eventName')}")
        except Exception as exc:  # noqa: BLE001 — report and continue
            failures += 1
            print(f"  ✗ {e['eventId']}  {e.get('eventName')}  — {exc}")

    print(f"\nDone. {len(candidates) - failures}/{len(candidates)} updated.")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
