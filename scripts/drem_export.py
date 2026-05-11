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
    parser.add_argument("--api", action="store_true",
                        help="Export via GraphQL API instead of DynamoDB (no AWS infra access needed)")
    parser.add_argument("--endpoint", help="AppSync GraphQL endpoint URL (required with --api)")
    parser.add_argument("--token", help="Cognito JWT token (required with --api)")
    args = parser.parse_args()

    if args.api:
        if not args.endpoint or not args.token:
            parser.error("--api requires both --endpoint and --token")
        _export_via_api(args)
        return

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

    # --- Racer Profiles (avatar + highlight colour) ---
    if "racer_profile" in tables:
        print("Exporting racer profiles...")
        profiles = scan_table(tables["racer_profile"], region)
        counts["racer_profiles"] = len(profiles)
        _write_json(output_dir, "racer_profiles.json", profiles)
        print(f"  {len(profiles)} profiles\n")
    else:
        print("WARNING: RacerProfile table not found, skipping.\n")

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


def _export_via_api(args):
    """Export via GraphQL API using JWT auth."""
    from drem_data.api_client import DremApiClient

    client = DremApiClient(args.endpoint, args.token)

    if args.output:
        output_dir = args.output.rstrip("/")
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
        output_dir = f"drem-export-{timestamp}"
    os.makedirs(output_dir, exist_ok=True)

    event_filter = None
    if args.events:
        event_filter = set(e.strip() for e in args.events.split(","))

    print(f"Endpoint: {args.endpoint}")
    print(f"Output:   {output_dir}/\n")

    counts = {}

    # --- Events ---
    print("Fetching events...")
    events = client.get_events()
    if event_filter:
        events = [e for e in events if e["eventId"] in event_filter]
    counts["events"] = len(events)
    _write_json(output_dir, "events.json", events)
    print(f"  {len(events)} events\n")

    # --- Races ---
    print("Fetching races...")
    races_by_event = {}
    total_races = 0
    for event in events:
        eid = event["eventId"]
        races = client.get_races(eid)
        if races:
            races_by_event[eid] = races
            total_races += len(races)
            print(f"  {event.get('eventName', eid)}: {len(races)} races")
    counts["races"] = total_races
    _write_json(output_dir, "races.json", races_by_event)
    print(f"  Total: {total_races} races\n")

    # --- Leaderboard ---
    print("Fetching leaderboards...")
    all_leaderboard = []
    lb_errors = 0
    for event in events:
        eid = event["eventId"]
        try:
            lb = client.get_leaderboard(eid)
            entries = lb.get("entries") or []
            for entry in entries:
                entry["eventId"] = eid
            all_leaderboard.extend(entries)
        except Exception:
            lb_errors += 1
    counts["leaderboard_entries"] = len(all_leaderboard)
    _write_json(output_dir, "leaderboard.json", all_leaderboard)
    msg = f"  {len(all_leaderboard)} entries"
    if lb_errors:
        msg += f" ({lb_errors} events skipped due to errors)"
    print(f"{msg}\n")

    # --- Fleets ---
    print("Fetching fleets...")
    fleets = client.get_all_fleets()
    counts["fleets"] = len(fleets)
    _write_json(output_dir, "fleets.json", fleets)
    print(f"  {len(fleets)} fleets\n")

    # --- Landing Pages ---
    # Landing page config is embedded in events from the API, extract it
    landing_pages = []
    for event in events:
        lpc = event.get("landingPageConfig")
        if lpc and lpc.get("links"):
            landing_pages.append({"eventId": event["eventId"], **lpc})
    counts["landing_pages"] = len(landing_pages)
    _write_json(output_dir, "landing_pages.json", landing_pages)
    print(f"  {len(landing_pages)} landing page configs\n")

    # --- Users ---
    if not args.skip_users:
        print("Fetching users...")
        users = client.list_users()
        counts["users"] = len(users)
        _write_json(output_dir, "users.json", users)
        print(f"  {len(users)} users\n")
    else:
        users = []
        print("Skipping users (--skip-users).\n")

    # --- Racer Profiles ---
    # No listRacerProfiles query; query getRacerProfile per known username.
    # Fall back to usernames seen on leaderboard entries when users are skipped.
    # Parallelised: serial round-trips at ~200ms each would be ~30 min for a
    # 9k-user export, easily blowing past a 1-hour JWT. AppSync handles dozens
    # of concurrent queries comfortably for read-only ops on a single key.
    print("Fetching racer profiles...")
    usernames = sorted({u["username"] for u in users if u.get("username")}
                       | {e["username"] for e in all_leaderboard if e.get("username")})
    profiles = []
    total = len(usernames)
    if total:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def _fetch(uname):
            try:
                return client.get_racer_profile(uname)
            except Exception:
                return None

        done = 0
        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = {pool.submit(_fetch, u): u for u in usernames}
            for fut in as_completed(futures):
                done += 1
                if done % 500 == 0 or done == total:
                    print(f"    {done}/{total} usernames queried...")
                p = fut.result()
                if p:
                    profiles.append(p)
    counts["racer_profiles"] = len(profiles)
    _write_json(output_dir, "racer_profiles.json", profiles)
    print(f"  {len(profiles)} profiles (queried {total} usernames)\n")

    # --- Manifest ---
    write_manifest(
        output_dir=output_dir,
        source_stack=f"api:{args.endpoint}",
        source_region="unknown",
        source_user_pool_id="",
        counts=counts,
        options={
            "skip_users": args.skip_users,
            "event_filter": list(event_filter) if event_filter else None,
            "export_mode": "api",
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
