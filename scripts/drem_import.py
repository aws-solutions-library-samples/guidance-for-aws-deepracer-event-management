#!/usr/bin/env python3
"""
drem_import.py — Import a DREM export directory into a DREM deployment.

Usage:
    python scripts/drem_import.py --input ./drem-export-xxx/     # full import
    python scripts/drem_import.py --input ./xxx/ --skip-users    # data only
    python scripts/drem_import.py --input ./xxx/ --dry-run       # preview
    python scripts/drem_import.py --input ./xxx/ --stack dev     # target different env
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from drem_data.discovery import discover_config
from drem_data.tables import (
    batch_write_items,
    remap_user_id_in_race,
    remap_user_id_in_leaderboard,
    remap_created_by,
)
from drem_data.cognito import import_users
from drem_data.manifest import read_manifest, update_manifest


def main():
    parser = argparse.ArgumentParser(description="Import a DREM export into a deployment")
    parser.add_argument("--input", required=True, help="Path to export directory")
    parser.add_argument("--skip-users", action="store_true", help="Skip Cognito user import")
    parser.add_argument("--skip-leaderboard", action="store_true", help="Skip leaderboard import")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--stack", help="Override stack label from build.config")
    args = parser.parse_args()

    input_dir = args.input.rstrip("/")
    if not os.path.isdir(input_dir):
        sys.exit(f"Export directory not found: {input_dir}")

    manifest = read_manifest(input_dir)
    print(f"Import from:  {input_dir}/")
    print(f"Exported at:  {manifest['exported_at']}")
    print(f"Source stack: {manifest['source_stack']}")
    print(f"Counts:       {manifest['counts']}")
    print()

    if args.dry_run:
        print("DRY RUN — nothing will be written.\n")

    config = discover_config(stack_override=args.stack)
    tables = config["tables"]
    region = config["region"]

    user_mapping = {}

    # --- Cognito Users ---
    if not args.skip_users:
        users_file = os.path.join(input_dir, "users.json")
        if os.path.exists(users_file):
            users = _read_json(users_file)
            print(f"Importing {len(users)} Cognito users...")
            if not config["user_pool_id"]:
                print("WARNING: No user pool ID found, skipping users.\n")
            else:
                user_mapping = import_users(
                    users, config["user_pool_id"], region, dry_run=args.dry_run
                )
                print(f"  Mapped {len(user_mapping)} user subs.\n")

                if not args.dry_run and user_mapping:
                    update_manifest(input_dir, {"import_user_mapping": user_mapping})
        else:
            print("No users.json found, skipping users.\n")
    else:
        print("Skipping Cognito users (--skip-users).\n")

    # --- Events ---
    events_file = os.path.join(input_dir, "events.json")
    if os.path.exists(events_file) and "events" in tables:
        events = _read_json(events_file)
        if user_mapping:
            events = [remap_created_by(e, user_mapping) for e in events]
        print(f"Importing {len(events)} events → {tables['events']}")
        n = batch_write_items(tables["events"], region, events, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} events.\n")

    # --- Races ---
    races_file = os.path.join(input_dir, "races.json")
    if os.path.exists(races_file) and "race" in tables:
        races_by_event = _read_json(races_file)
        all_races = []
        for event_id, races in races_by_event.items():
            for race in races:
                if user_mapping:
                    race = remap_user_id_in_race(race, user_mapping)
                all_races.append(race)
        print(f"Importing {len(all_races)} races → {tables['race']}")
        n = batch_write_items(tables["race"], region, all_races, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} races.\n")

    # --- Leaderboard ---
    if not args.skip_leaderboard:
        lb_file = os.path.join(input_dir, "leaderboard.json")
        if os.path.exists(lb_file) and "leaderboard" in tables:
            leaderboard = _read_json(lb_file)
            if user_mapping:
                leaderboard = [remap_user_id_in_leaderboard(e, user_mapping) for e in leaderboard]
            print(f"Importing {len(leaderboard)} leaderboard entries → {tables['leaderboard']}")
            n = batch_write_items(tables["leaderboard"], region, leaderboard, dry_run=args.dry_run)
            print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} entries.\n")
    else:
        print("Skipping leaderboard (--skip-leaderboard).\n")

    # --- Fleets ---
    fleets_file = os.path.join(input_dir, "fleets.json")
    if os.path.exists(fleets_file) and "fleets" in tables:
        fleets = _read_json(fleets_file)
        if user_mapping:
            fleets = [remap_created_by(f, user_mapping) for f in fleets]
        print(f"Importing {len(fleets)} fleets → {tables['fleets']}")
        n = batch_write_items(tables["fleets"], region, fleets, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} fleets.\n")

    # --- Landing Pages ---
    lp_file = os.path.join(input_dir, "landing_pages.json")
    if os.path.exists(lp_file) and "landing_pages" in tables:
        landing_pages = _read_json(lp_file)
        print(f"Importing {len(landing_pages)} landing page configs → {tables['landing_pages']}")
        n = batch_write_items(tables["landing_pages"], region, landing_pages, dry_run=args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} configs.\n")

    if args.dry_run:
        print("Dry run complete — no changes made.")
    else:
        print("Import complete.")


def _read_json(path: str):
    """Read a JSON file."""
    with open(path) as f:
        return json.load(f)


if __name__ == "__main__":
    main()
