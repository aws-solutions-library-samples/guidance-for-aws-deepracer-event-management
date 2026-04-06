#!/usr/bin/env python3
"""
drem_export.py — Export a full DREM instance to a portable directory.

Usage:
    python scripts/drem_export.py                           # full export
    python scripts/drem_export.py --output ./my-export/     # custom output dir
    python scripts/drem_export.py --skip-users              # data only
    python scripts/drem_export.py --events evt-1,evt-2      # specific events
    python scripts/drem_export.py --stack dev               # override stack label
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from drem_data.discovery import discover_config
from drem_data.tables import scan_table, from_decimal
from drem_data.cognito import export_users
from drem_data.manifest import write_manifest


def main():
    parser = argparse.ArgumentParser(description="Export a DREM instance to portable files")
    parser.add_argument("--output", help="Output directory (default: auto-named)")
    parser.add_argument("--skip-users", action="store_true", help="Skip Cognito user export")
    parser.add_argument("--events", help="Comma-separated event IDs to export (default: all)")
    parser.add_argument("--stack", help="Override stack label from build.config")
    args = parser.parse_args()

    config = discover_config(stack_override=args.stack)
    tables = config["tables"]
    region = config["region"]

    if args.output:
        output_dir = args.output.rstrip("/")
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
        output_dir = f"drem-export-{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output: {output_dir}/\n")

    event_filter = None
    if args.events:
        event_filter = set(e.strip() for e in args.events.split(","))

    counts = {}

    # --- Events ---
    if "events" in tables:
        print("Exporting events...")
        events = scan_table(tables["events"], region)
        if event_filter:
            events = [e for e in events if e["eventId"] in event_filter]
        counts["events"] = len(events)
        _write_json(output_dir, "events.json", events)
        print(f"  {len(events)} events\n")
    else:
        print("WARNING: Events table not found, skipping.\n")
        events = []

    event_ids = {e["eventId"] for e in events}

    # --- Races ---
    if "race" in tables:
        print("Exporting races...")
        all_races = scan_table(tables["race"], region)
        races_by_event = {}
        for race in all_races:
            eid = race.get("eventId")
            if event_filter and eid not in event_ids:
                continue
            races_by_event.setdefault(eid, []).append(race)
        total_races = sum(len(r) for r in races_by_event.values())
        counts["races"] = total_races
        _write_json(output_dir, "races.json", races_by_event)
        print(f"  {total_races} races across {len(races_by_event)} events\n")
    else:
        print("WARNING: Race table not found, skipping.\n")

    # --- Leaderboard ---
    if "leaderboard" in tables:
        print("Exporting leaderboard...")
        leaderboard = scan_table(tables["leaderboard"], region)
        if event_filter:
            leaderboard = [e for e in leaderboard if e.get("eventId") in event_ids]
        counts["leaderboard_entries"] = len(leaderboard)
        _write_json(output_dir, "leaderboard.json", leaderboard)
        print(f"  {len(leaderboard)} entries\n")
    else:
        print("WARNING: Leaderboard table not found, skipping.\n")

    # --- Fleets ---
    if "fleets" in tables:
        print("Exporting fleets...")
        fleets = scan_table(tables["fleets"], region)
        counts["fleets"] = len(fleets)
        _write_json(output_dir, "fleets.json", fleets)
        print(f"  {len(fleets)} fleets\n")
    else:
        print("WARNING: Fleets table not found, skipping.\n")

    # --- Landing Pages ---
    if "landing_pages" in tables:
        print("Exporting landing page configs...")
        landing_pages = scan_table(tables["landing_pages"], region)
        if event_filter:
            landing_pages = [lp for lp in landing_pages if lp.get("eventId") in event_ids]
        counts["landing_pages"] = len(landing_pages)
        _write_json(output_dir, "landing_pages.json", landing_pages)
        print(f"  {len(landing_pages)} configs\n")
    else:
        print("WARNING: Landing pages table not found, skipping.\n")

    # --- Cognito Users ---
    if not args.skip_users and config["user_pool_id"]:
        print("Exporting Cognito users...")
        users = export_users(config["user_pool_id"], region)
        counts["users"] = len(users)
        _write_json(output_dir, "users.json", users)
        print(f"  {len(users)} users\n")
    elif args.skip_users:
        print("Skipping Cognito users (--skip-users).\n")
    else:
        print("WARNING: No user pool ID found, skipping users.\n")

    # --- Manifest ---
    write_manifest(
        output_dir=output_dir,
        source_stack=config["stack_name"],
        source_region=region,
        source_user_pool_id=config.get("user_pool_id", ""),
        counts=counts,
        options={
            "skip_users": args.skip_users,
            "event_filter": list(event_filter) if event_filter else None,
        },
    )

    print(f"Export complete → {output_dir}/")
    print(f"  {counts}")


def _write_json(directory: str, filename: str, data):
    """Write data to a JSON file in the export directory."""
    path = os.path.join(directory, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


if __name__ == "__main__":
    main()
