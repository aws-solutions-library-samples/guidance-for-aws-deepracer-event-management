#!/usr/bin/env python3
"""
seed.py — Seed a DREM deployment with test data.

Two modes:
  1. Synthetic: generate fake events, racers, races, leaderboard entries,
     and a RacerProfile per racer (random avataaars + tail-light highlight)
  2. Import: load from an export.json file (produced by drem-api-stats/export.py);
     RacerProfile entries are synthesised for each imported racer.

Usage:
    # Synthetic seed with defaults (2 events, 10 racers, 5 races per racer)
    python scripts/seed.py --stack drem-backend-main-infrastructure

    # Custom synthetic seed
    python scripts/seed.py --stack drem-backend-main-infrastructure \
        --events 3 --racers 20 --races-per-racer 8

    # Import from export file
    python scripts/seed.py --stack drem-backend-main-infrastructure \
        --import-file export.json

    # Dry run (preview without writing)
    python scripts/seed.py --stack drem-backend-main-infrastructure --dry-run

    # Create Cognito users (adds users who can log in after password reset)
    python scripts/seed.py --stack drem-backend-main-infrastructure --create-users
"""
import argparse
import json
import random
import string
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from functools import reduce
from statistics import mean

import boto3


try:
    from faker import Faker
    fake = Faker()
except ImportError:
    sys.exit("Faker is required: pip install faker (or pip install -e .[dev])")

DEFAULT_STACK = "drem-backend-main-infrastructure"

COUNTRY_CODES = ["GB", "US", "DE", "FR", "JP", "AU", "CA", "NL", "SE", "ES",
                 "IT", "BR", "IN", "KR", "SG"]

TRACK_TYPES = ["REINVENT_2018", "ATOZ_SPEEDWAY"]

# Lap time distributions per track type (mean_ms, stddev_ms)
LAP_TIME_PROFILES = {
    "REINVENT_2018": (8000, 1500),
    "ATOZ_SPEEDWAY": (14000, 2500),
}

EVENT_TYPES = ["OFFICIAL_TRACK_RACE", "PRIVATE_TRACK_RACE", "PRIVATE_WORKSHOP",
               "OFFICIAL_WORKSHOP", "OTHER"]

# avataaars option pools (mirrors website/src/admin/user-profile/AvatarBuilder.tsx)
AVATAR_OPTIONS = {
    "topType": [
        "NoHair", "Eyepatch", "Hat", "Hijab", "Turban",
        "WinterHat1", "WinterHat2", "WinterHat3", "WinterHat4",
        "LongHairBigHair", "LongHairBob", "LongHairBun", "LongHairCurly",
        "LongHairCurvy", "LongHairDreads", "LongHairFrida", "LongHairFro",
        "LongHairFroBand", "LongHairNotTooLong", "LongHairShavedSides",
        "LongHairMiaWallace", "LongHairStraight", "LongHairStraight2",
        "LongHairStraightStrand", "ShortHairDreads01", "ShortHairDreads02",
        "ShortHairFrizzle", "ShortHairShaggyMullet", "ShortHairShortCurly",
        "ShortHairShortFlat", "ShortHairShortRound", "ShortHairShortWaved",
        "ShortHairSides", "ShortHairTheCaesar", "ShortHairTheCaesarSidePart",
    ],
    "accessoriesType": ["Blank", "Kurt", "Prescription01", "Prescription02", "Round", "Sunglasses", "Wayfarers"],
    "hairColor": ["Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "PastelPink", "Platinum", "Red", "SilverGray"],
    "facialHairType": ["Blank", "BeardMedium", "BeardLight", "BeardMajestic", "MoustacheFancy", "MoustacheMagnum"],
    "facialHairColor": ["Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "Platinum", "Red"],
    "clotheType": ["BlazerShirt", "BlazerSweater", "CollarSweater", "GraphicShirt", "Hoodie", "Overall", "ShirtCrewNeck", "ShirtScoopNeck", "ShirtVNeck"],
    "clotheColor": ["Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02", "Heather", "PastelBlue", "PastelGreen", "PastelOrange", "PastelRed", "PastelYellow", "Pink", "Red", "White"],
    "eyeType": ["Close", "Cry", "Default", "Dizzy", "EyeRoll", "Happy", "Hearts", "Side", "Squint", "Surprised", "Wink", "WinkWacky"],
    "eyebrowType": ["Angry", "AngryNatural", "Default", "DefaultNatural", "FlatNatural", "RaisedExcited", "RaisedExcitedNatural", "SadConcerned", "SadConcernedNatural", "UnibrowNatural", "UpDown", "UpDownNatural"],
    "mouthType": ["Concerned", "Default", "Disbelief", "Eating", "Grimace", "Sad", "ScreamOpen", "Serious", "Smile", "Tongue", "Twinkle", "Vomit"],
    "skinColor": ["Tanned", "Yellow", "Pale", "Light", "Brown", "DarkBrown", "Black"],
}

# DeepRacer car tail-light colour palette (mirrors AvatarBuilder.tsx)
TAIL_LIGHT_COLOURS = [
    "#0000FF", "#1E8FFF", "#800080", "#673ab7", "#FF00FF", "#e91e63",
    "#FF0090", "#FF0000", "#FF8200", "#FFFF00", "#00FF00", "#417505", "#FFFFFF",
]


# ---------------------------------------------------------------------------
# Table discovery (from drem-api-stats/import_to_drem.py)
# ---------------------------------------------------------------------------

def discover_tables(stack_name: str) -> dict:
    """Find DDB table names by inspecting Lambda env vars in the stack."""
    lambda_client = boto3.client("lambda")
    tables = {}

    fn_names = set()
    try:
        cf = boto3.client("cloudformation")
        paginator = cf.get_paginator("list_stack_resources")
        for page in paginator.paginate(StackName=stack_name):
            for r in page["StackResourceSummaries"]:
                if r["ResourceType"] == "AWS::Lambda::Function":
                    fn_names.add(r["PhysicalResourceId"])
    except Exception:
        pass

    if not fn_names:
        fragment = stack_name.replace("-infrastructure", "").replace("-infra", "")
        paginator = lambda_client.get_paginator("list_functions")
        for page in paginator.paginate():
            for fn in page["Functions"]:
                if fragment in fn["FunctionName"]:
                    fn_names.add(fn["FunctionName"])

    for fn_name in fn_names:
        try:
            resp = lambda_client.get_function_configuration(FunctionName=fn_name)
        except Exception:
            continue
        env = resp.get("Environment", {}).get("Variables", {})
        table = env.get("DDB_TABLE")
        if not table:
            continue
        fn_lower = fn_name.lower()
        if "racemanager" in fn_lower and "race" not in tables:
            tables["race"] = table
        elif "eventsmanager" in fn_lower and "events" not in tables:
            tables["events"] = table
        elif "leaderboard" in fn_lower and "leaderboard" not in tables:
            tables["leaderboard"] = table

    # RacerProfile has no Lambda — direct DDB JS resolvers via AppSync.
    # Find its table by CFN logical ID instead.
    try:
        cf = boto3.client("cloudformation")
        paginator = cf.get_paginator("list_stack_resources")
        for page in paginator.paginate(StackName=stack_name):
            for r in page["StackResourceSummaries"]:
                if (r["ResourceType"] == "AWS::DynamoDB::Table"
                        and "RacerProfile" in r["LogicalResourceId"]
                        and "racer_profile" not in tables):
                    tables["racer_profile"] = r["PhysicalResourceId"]
    except Exception:
        pass

    return tables


def discover_user_pool(stack_name: str) -> str:
    """Find the Cognito User Pool ID from the stack."""
    cf = boto3.client("cloudformation")
    paginator = cf.get_paginator("list_stack_resources")
    for page in paginator.paginate(StackName=stack_name.replace("-infrastructure", "-base")):
        for r in page["StackResourceSummaries"]:
            if r["ResourceType"] == "AWS::Cognito::UserPool":
                return r["PhysicalResourceId"]
    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(i) for i in obj]
    return obj


def generate_lap_time(track_type: str, skill: float) -> float:
    """Generate a realistic lap time in ms. skill 0.0=slow, 1.0=fast."""
    mean_ms, stddev_ms = LAP_TIME_PROFILES.get(track_type, (12000, 2000))
    # Better racers have lower times (range: 0.85x to 1.5x of mean)
    adjusted_mean = mean_ms * (1.5 - skill * 0.65)
    return max(5500, random.gauss(adjusted_mean, stddev_ms))


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------

def generate_avatar_config() -> dict:
    """Pick a random value from each avataaars option pool."""
    return {key: random.choice(values) for key, values in AVATAR_OPTIONS.items()}


def generate_racer_username() -> str:
    """Generate a DeepRacer-style username using Faker."""
    styles = [
        lambda: fake.first_name() + fake.random_element(["Speed", "Racer", "Drift", "Turbo", "Nitro"]),
        lambda: fake.first_name() + str(fake.random_int(min=1, max=99)),
        lambda: fake.user_name(),
        lambda: fake.first_name() + fake.last_name(),
    ]
    return random.choice(styles)()


def generate_racers(count: int) -> list:
    """Generate a list of synthetic racers with Faker-generated identities."""
    seen_names = set()
    racers = []
    for _ in range(count):
        # Ensure unique usernames
        for _ in range(10):
            name = generate_racer_username()
            if name not in seen_names:
                seen_names.add(name)
                break

        country = random.choice(COUNTRY_CODES)
        racers.append({
            "userId": str(uuid.uuid4()),
            "username": name,
            "email": fake.email(),
            "countryCode": country,
            "skill": random.uniform(0.2, 1.0),  # internal: determines lap time quality
            "avatarConfig": generate_avatar_config(),
            "highlightColour": random.choice(TAIL_LIGHT_COLOURS),
        })
    return racers


def generate_event_name() -> str:
    """Generate a realistic DeepRacer event name using Faker."""
    templates = [
        lambda: f"AWS {fake.city()} Summit {fake.year()}",
        lambda: f"{fake.company()} DeepRacer Challenge",
        lambda: f"AWS re:Invent {fake.year()} - {fake.city()} Track",
        lambda: f"{fake.city()} Community Race Day",
        lambda: f"AWS {fake.country()} DeepRacer League",
        lambda: f"{fake.company()} Innovation Day Race",
    ]
    return random.choice(templates)()


def generate_event(index: int, track_type: str = None) -> dict:
    """Generate a synthetic event with a Faker-generated name."""
    track_type = track_type or random.choice(TRACK_TYPES)
    event_date = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90))

    return {
        "eventId": str(uuid.uuid4()),
        "eventName": generate_event_name(),
        "eventDate": event_date.strftime("%Y-%m-%d"),
        "typeOfEvent": random.choice(EVENT_TYPES),
        "countryCode": random.choice(COUNTRY_CODES),
        "createdAt": event_date.isoformat(),
        "createdBy": "drem-seed",
        "sponsor": fake.company(),
        "raceConfig": {
            "trackType": track_type,
            "rankingMethod": "BEST_LAP_TIME",
            "raceTimeInMin": 2,
            "numberOfResetsPerLap": 3,
            "averageLapsWindow": 3,
            "maxRunsPerRacer": 3,
        },
        "tracks": [{
            "trackId": "1",
            "leaderBoardTitle": f"Track 1 - {track_type}",
            "leaderBoardFooter": "",
            "fleetId": "fleet-1",
        }],
    }


def generate_race(event_id: str, track_id: str, racer: dict,
                  track_type: str, race_time_min: int = 2) -> dict:
    """Generate a synthetic race with realistic lap times."""
    skill = racer["skill"]
    race_time_ms = race_time_min * 60 * 1000
    elapsed = 0
    laps = []
    lap_id = 0

    while elapsed < race_time_ms:
        lap_time = generate_lap_time(track_type, skill)
        resets = random.choices([0, 1, 2, 3], weights=[60, 25, 10, 5])[0]
        is_valid = resets <= 3 and random.random() > 0.1  # 10% chance of invalid even with few resets

        laps.append({
            "lapId": lap_id,
            "time": round(lap_time, 1),
            "resets": resets,
            "isValid": is_valid,
        })
        elapsed += lap_time
        lap_id += 1

    # Compute average laps (rolling window of 3)
    window = 3
    avg_laps = []
    valid_laps = [l for l in laps if l["isValid"]]
    for i in range(len(valid_laps) - window + 1):
        window_laps = valid_laps[i:i + window]
        avg_time = mean(l["time"] for l in window_laps)
        avg_laps.append({
            "startLapId": window_laps[0]["lapId"],
            "endLapId": window_laps[-1]["lapId"],
            "avgTime": round(avg_time, 1),
        })

    return {
        "raceId": str(uuid.uuid4()),
        "userId": racer["userId"],
        "trackId": track_id,
        "racedByProxy": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "laps": laps,
        "averageLaps": avg_laps,
    }


def generate_synthetic_data(num_events: int, num_racers: int,
                           races_per_racer: int) -> dict:
    """Generate a complete synthetic dataset."""
    racers = generate_racers(num_racers)
    events = [generate_event(i) for i in range(num_events)]

    all_races = {}
    for event in events:
        event_id = event["eventId"]
        track_type = event["raceConfig"]["trackType"]
        race_time = event["raceConfig"]["raceTimeInMin"]
        all_races[event_id] = []

        for racer in racers:
            num_races = random.randint(1, races_per_racer)
            for _ in range(num_races):
                race = generate_race(event_id, "1", racer, track_type, race_time)
                all_races[event_id].append(race)

    users = {r["userId"]: r["username"] for r in racers}

    return {
        "events": events,
        "races": all_races,
        "users": users,
        "racers": racers,  # extra info for Cognito user creation
    }


# ---------------------------------------------------------------------------
# Leaderboard computation (mirrors DREM's __calculate_race_summary)
# ---------------------------------------------------------------------------

def compute_leaderboard_entry(event_id: str, track_id: str, user_id: str,
                              races: list, username: str) -> dict:
    valid_laps = []
    invalid_laps = []
    for race in races:
        for lap in race.get("laps") or []:
            if lap.get("isValid"):
                valid_laps.append(lap)
            else:
                invalid_laps.append(lap)

    total_laps = len(valid_laps) + len(invalid_laps)
    valid_times = [lap["time"] for lap in valid_laps]

    all_avg_laps = [avg for race in races for avg in (race.get("averageLaps") or [])]
    fastest_avg_lap = None
    if all_avg_laps:
        fastest_avg_lap = reduce(
            lambda x, y: x if x["avgTime"] < y["avgTime"] else y,
            all_avg_laps,
        )

    streaks = []
    for race in races:
        streak = 0
        for lap in race.get("laps") or []:
            if lap.get("isValid"):
                streak += 1
            else:
                streaks.append(streak)
                streak = 0
        streaks.append(streak)
    most_consecutive = max(streaks) if streaks else 0

    return {
        "eventId": event_id,
        "sk": f"{track_id}#{user_id}",
        "type": "leaderboard_entry",
        "trackId": track_id,
        "userId": user_id,
        "username": username,
        "countryCode": "",
        "racedByProxy": any(r.get("racedByProxy") for r in races),
        "numberOfValidLaps": len(valid_laps),
        "numberOfInvalidLaps": len(invalid_laps),
        "fastestLapTime": min(valid_times) if valid_times else None,
        "fastestAverageLap": fastest_avg_lap,
        "avgLapTime": mean(valid_times) if valid_times else None,
        "lapCompletionRatio": round(len(valid_laps) / total_laps, 1) * 100 if total_laps else 0.0,
        "avgLapsPerAttempt": round(total_laps / len(races), 1) if races else 0.0,
        "mostConcecutiveLaps": most_consecutive,
    }


# ---------------------------------------------------------------------------
# DynamoDB writers
# ---------------------------------------------------------------------------

class NullBatch:
    """No-op context manager for dry-run mode."""
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def put_item(self, **kwargs): pass


def write_events(table, events: list, dry_run: bool) -> int:
    count = 0
    for event in events:
        item = {**event}
        item.pop("racers", None)  # remove synthetic-only field
        if dry_run:
            print(f"  [DRY] event: {item.get('eventName', '?')} ({item['eventId'][:8]}...)")
        else:
            table.put_item(Item=to_decimal(item))
        count += 1
    return count


def write_races(table, event_id: str, races: list, dry_run: bool) -> int:
    count = 0
    batch_ctx = table.batch_writer() if not dry_run else NullBatch()
    with batch_ctx as batch:
        for race in races:
            track_id = race["trackId"]
            user_id = race["userId"]
            race_id = race["raceId"]
            item = {
                **race,
                "eventId": event_id,
                "sk": f"TRACK#{track_id}#USER#{user_id}#RACE#{race_id}",
                "type": "race",
            }
            if dry_run:
                laps = len(race.get("laps", []))
                print(f"  [DRY] race: user={user_id[:8]}... laps={laps}")
            else:
                batch.put_item(Item=to_decimal(item))
            count += 1
    return count


def write_leaderboard(table, entries: list, dry_run: bool) -> int:
    count = 0
    batch_ctx = table.batch_writer() if not dry_run else NullBatch()
    with batch_ctx as batch:
        for entry in entries:
            if entry.get("fastestLapTime") is None:
                continue
            if dry_run:
                print(f"  [DRY] leaderboard: {entry['username']} "
                      f"fastest={entry['fastestLapTime']:.0f}ms")
            else:
                batch.put_item(Item=to_decimal(entry))
            count += 1
    return count


def write_racer_profiles(table, racers: list, dry_run: bool) -> int:
    """Write avatar + highlight colour to the RacerProfile DDB table, keyed by
    username. Only writes for racers that have avatarConfig set (the import
    path won't have one)."""
    count = 0
    now = datetime.now(timezone.utc).isoformat()
    batch_ctx = table.batch_writer() if not dry_run else NullBatch()
    with batch_ctx as batch:
        for racer in racers:
            avatar = racer.get("avatarConfig")
            if not avatar:
                continue
            item = {
                "username": racer["username"],
                "avatarConfig": json.dumps(avatar),  # column is AWSJSON
                "highlightColour": racer.get("highlightColour") or "",
                "updatedAt": now,
            }
            if dry_run:
                print(f"  [DRY] profile: {racer['username']} highlight={item['highlightColour']}")
            else:
                batch.put_item(Item=to_decimal(item))
            count += 1
    return count


def create_cognito_users(user_pool_id: str, racers: list, dry_run: bool) -> int:
    """Create Cognito users in FORCE_CHANGE_PASSWORD state."""
    cognito = boto3.client("cognito-idp")
    count = 0
    for racer in racers:
        username = racer["username"]
        email = racer["email"]
        country = racer.get("countryCode", "")

        try:
            # Check if user exists
            resp = cognito.list_users(
                UserPoolId=user_pool_id,
                Limit=1,
                Filter=f'username = "{username}"',
            )
            if resp["Users"]:
                print(f"  [SKIP] {username} (already exists)")
                continue
        except Exception as e:
            print(f"  [ERROR] checking {username}: {e}")
            continue

        if dry_run:
            print(f"  [DRY] create user: {username} ({email})")
        else:
            try:
                cognito.admin_create_user(
                    UserPoolId=user_pool_id,
                    Username=username,
                    UserAttributes=[
                        {"Name": "email", "Value": email},
                        {"Name": "email_verified", "Value": "true"},
                        {"Name": "custom:countryCode", "Value": country},
                    ],
                    MessageAction="SUPPRESS",  # don't send welcome email
                )
                # Add to racer group
                try:
                    cognito.admin_add_user_to_group(
                        UserPoolId=user_pool_id,
                        Username=username,
                        GroupName="racer",
                    )
                except Exception:
                    pass  # group might not exist
                print(f"  [OK] {username}")
            except Exception as e:
                print(f"  [ERROR] {username}: {e}")
                continue
        count += 1
    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Seed a DREM deployment with test data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Synthetic seed with defaults
  python scripts/seed.py --stack drem-backend-main-infrastructure

  # Custom synthetic seed
  python scripts/seed.py --events 3 --racers 20 --races-per-racer 8

  # Import from export file
  python scripts/seed.py --import-file export.json

  # Dry run
  python scripts/seed.py --dry-run

  # Also create Cognito users
  python scripts/seed.py --create-users
        """,
    )
    parser.add_argument("--stack", default=DEFAULT_STACK,
                        help=f"Stack name for table auto-discovery (default: {DEFAULT_STACK})")
    parser.add_argument("--import-file",
                        help="Import from export.json instead of generating synthetic data")
    parser.add_argument("--events", type=int, default=2,
                        help="Number of events to generate (default: 2)")
    parser.add_argument("--racers", type=int, default=10,
                        help="Number of racers to generate (default: 10)")
    parser.add_argument("--races-per-racer", type=int, default=5,
                        help="Max races per racer per event (default: 5)")
    parser.add_argument("--create-users", action="store_true",
                        help="Create Cognito users (FORCE_CHANGE_PASSWORD state)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview without writing to DynamoDB/Cognito")
    args = parser.parse_args()

    # --- Load or generate data ---
    if args.import_file:
        print(f"Loading data from {args.import_file}...")
        try:
            with open(args.import_file) as f:
                export = json.load(f)
        except FileNotFoundError:
            sys.exit(f"File not found: {args.import_file}")
        data = {
            "events": export["events"],
            "races": export["races"],
            "users": export["users"],
            "racers": [{"userId": uid, "username": uname, "email": f"{uname.lower()}@example.com",
                        "countryCode": "",
                        "avatarConfig": generate_avatar_config(),
                        "highlightColour": random.choice(TAIL_LIGHT_COLOURS)}
                       for uid, uname in export["users"].items()],
        }
        print(f"  Events: {len(data['events'])}")
        print(f"  Races:  {sum(len(r) for r in data['races'].values())}")
        print(f"  Users:  {len(data['users'])}")
    else:
        print(f"Generating synthetic data: {args.events} events, "
              f"{args.racers} racers, up to {args.races_per_racer} races each...")
        data = generate_synthetic_data(args.events, args.racers, args.races_per_racer)
        total_races = sum(len(r) for r in data["races"].values())
        print(f"  Generated {len(data['events'])} events, {total_races} races, "
              f"{len(data['racers'])} racers")
    print()

    # --- Discover tables ---
    print(f"Discovering tables from stack: {args.stack}...")
    tables = discover_tables(args.stack)
    for key, name in tables.items():
        print(f"  {key:12}: {name}")
    if not tables:
        sys.exit("No tables found. Check --stack name.")
    print()

    if args.dry_run:
        print("DRY RUN — nothing will be written.\n")

    ddb = boto3.resource("dynamodb")

    # --- Write events ---
    if "events" in tables:
        print(f"Writing events → {tables['events']}")
        n = write_events(ddb.Table(tables["events"]), data["events"], args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} events.\n")

    # --- Write races ---
    if "race" in tables:
        print(f"Writing races → {tables['race']}")
        table = ddb.Table(tables["race"])
        total = 0
        for event_id, races in data["races"].items():
            n = write_races(table, event_id, races, args.dry_run)
            total += n
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {total} races.\n")

    # --- Compute and write leaderboard ---
    if "leaderboard" in tables:
        print(f"Computing leaderboard entries → {tables['leaderboard']}")
        grouped = defaultdict(list)
        for event_id, races in data["races"].items():
            for race in races:
                key = (event_id, race["trackId"], race["userId"])
                grouped[key].append(race)

        entries = []
        for (event_id, track_id, user_id), races in grouped.items():
            username = data["users"].get(user_id) or user_id[:8] + "..."
            entry = compute_leaderboard_entry(event_id, track_id, user_id, races, username)
            entries.append(entry)

        n = write_leaderboard(ddb.Table(tables["leaderboard"]), entries, args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} leaderboard entries.\n")

    # --- Write racer profiles (avatar + highlight colour) ---
    if "racer_profile" in tables:
        print(f"Writing racer profiles → {tables['racer_profile']}")
        n = write_racer_profiles(ddb.Table(tables["racer_profile"]), data["racers"], args.dry_run)
        print(f"  {'Would write' if args.dry_run else 'Wrote'} {n} racer profiles.\n")

    # --- Create Cognito users ---
    if args.create_users:
        base_stack = args.stack.replace("-infrastructure", "-base")
        print(f"Discovering Cognito User Pool from {base_stack}...")
        user_pool_id = discover_user_pool(args.stack)
        if not user_pool_id:
            print("  WARNING: No User Pool found — skipping user creation.\n")
        else:
            print(f"  User Pool: {user_pool_id}")
            print(f"Creating {len(data['racers'])} Cognito users...")
            n = create_cognito_users(user_pool_id, data["racers"], args.dry_run)
            print(f"  {'Would create' if args.dry_run else 'Created'} {n} users.\n")

    if args.dry_run:
        print("Dry run complete — no changes made.")
    else:
        print("Seed complete!")


if __name__ == "__main__":
    main()
