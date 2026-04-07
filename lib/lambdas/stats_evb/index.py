#!/usr/bin/python3
# encoding=utf-8
"""
Stats EVB Lambda — triggered by raceSummary EventBridge events.
Reads race + event data, computes stats, writes to StatsTable.
"""
import json
import os
from decimal import Decimal

import boto3
import dynamo_helpers
from aws_lambda_powertools import Logger, Tracer
from boto3.dynamodb.conditions import Attr, Key

from compute import compute_event_stats, build_racer_event_summary
from models import MIN_VALID_LAP_MS

tracer = Tracer()
logger = Logger()

dynamodb = boto3.resource("dynamodb")
cognito_client = boto3.client("cognito-idp")

STATS_TABLE_NAME = os.environ["STATS_TABLE"]
RACE_TABLE_NAME = os.environ["RACE_TABLE"]
EVENTS_TABLE_NAME = os.environ["EVENTS_TABLE"]
USER_POOL_ID = os.environ["USER_POOL_ID"]

stats_table = dynamodb.Table(STATS_TABLE_NAME)
race_table = dynamodb.Table(RACE_TABLE_NAME)
events_table = dynamodb.Table(EVENTS_TABLE_NAME)

FASTEST_LAPS_MAX = 10


@tracer.capture_lambda_handler
def lambda_handler(evb_event, context):
    logger.info(evb_event)

    detail_type = evb_event["detail-type"]
    detail = evb_event["detail"]
    event_id = detail["eventId"]
    user_id = detail["userId"]
    track_id = detail.get("trackId", "unknown")

    if "raceSummaryDeleted" in detail_type:
        _handle_delete(event_id, user_id, track_id)
    elif "raceSummaryAdded" in detail_type or "raceSummaryUpdated" in detail_type:
        _handle_upsert(event_id, user_id)
    else:
        logger.warning(f"Unsupported detail_type: {detail_type}")


def _handle_upsert(event_id: str, user_id: str):
    """Recompute stats for the racer and update global aggregates."""
    event = _get_event(event_id)
    if not event:
        logger.warning(f"Event {event_id} not found, skipping")
        return

    races = _get_all_races_for_event(event_id)

    unique_user_ids = list({r["userId"] for r in races})
    user_map = {}
    for uid in unique_user_ids:
        username, country_code = _get_username_by_user_id(uid)
        user_map[uid] = {"username": username, "countryCode": country_code}

    event_data = dynamo_helpers.replace_decimal_with_float(event)
    races_data = dynamo_helpers.replace_decimal_with_float(races)
    event_stats = compute_event_stats(event_data, races_data, user_map=user_map)
    if not event_stats:
        logger.info(f"No stats computed for event {event_id}")
        return

    _rebuild_global_stats()


def _handle_delete(event_id: str, user_id: str, track_id: str):
    """Handle race deletion — recompute from scratch."""
    _handle_upsert(event_id, user_id)


def _get_event(event_id: str) -> dict | None:
    """Read event metadata from the events table."""
    response = events_table.get_item(Key={"eventId": event_id})
    return response.get("Item")


def _get_all_races_for_event(event_id: str) -> list[dict]:
    """Read all race items for an event from the race table."""
    items = []
    response = race_table.query(
        KeyConditionExpression=Key("eventId").eq(event_id),
        FilterExpression=Attr("type").eq("race"),
    )
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        response = race_table.query(
            KeyConditionExpression=Key("eventId").eq(event_id),
            FilterExpression=Attr("type").eq("race"),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response["Items"])
    return items


def _get_username_by_user_id(user_id: str) -> tuple[str, str]:
    """Look up username and countryCode from Cognito."""
    try:
        response = cognito_client.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'sub = "{user_id}"',
        )
        if not response["Users"]:
            return user_id[:8], ""
        user = response["Users"][0]
        username = user["Username"]
        country_code = ""
        for attr in user["Attributes"]:
            if attr["Name"] == "custom:countryCode":
                country_code = attr["Value"]
        return username, country_code
    except Exception as e:
        logger.warning(f"Cognito lookup failed for {user_id}: {e}")
        return user_id[:8], ""


def _rebuild_global_stats():
    """
    Scan ALL events + races to rebuild global aggregates.

    For Phase 1 this is a full scan. Acceptable because:
    - Stats Lambda runs async (EVB trigger, not in request path)
    - Typical DREM deployment has <100 events, <10k races
    - Timeout is 5 minutes
    """
    events = _scan_all_events()

    total_events = 0
    total_racers = set()
    total_laps = 0
    total_valid_laps = 0
    countries = set()
    events_by_country = {}
    events_by_month = {}
    event_type_counts = {}
    track_type_counts = {}
    fastest_laps = []

    EXCLUDED_EVENT_TYPES = {"TEST_EVENT"}

    for event in events:
        event_id = event["eventId"]
        event_data = dynamo_helpers.replace_decimal_with_float(event)

        if event_data.get("typeOfEvent") in EXCLUDED_EVENT_TYPES:
            continue

        races = _get_all_races_for_event(event_id)
        if not races:
            continue
        races_data = dynamo_helpers.replace_decimal_with_float(races)

        event_stats = compute_event_stats(event_data, races_data)
        if not event_stats:
            continue

        total_events += 1
        country = event_stats.country_code
        if country:
            countries.add(country)
            events_by_country.setdefault(country, {"events": 0, "racers": 0, "laps": 0})
            events_by_country[country]["events"] += 1
            events_by_country[country]["racers"] += event_stats.total_racers
            events_by_country[country]["laps"] += event_stats.total_valid_laps

        month = (event_stats.event_date or "")[:7]
        if month:
            events_by_month.setdefault(month, {"events": 0, "races": 0})
            events_by_month[month]["events"] += 1
            events_by_month[month]["races"] += event_stats.total_races

        event_type = event_stats.event_type
        if event_type:
            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1

        track_type = (event_stats.race_config.get("trackType") or "")
        if track_type:
            track_type_counts.setdefault(track_type, {"count": 0, "bestLapMs": None})
            track_type_counts[track_type]["count"] += 1
            best = event_stats.overall_best_lap_ms
            if best is not None:
                current = track_type_counts[track_type]["bestLapMs"]
                if current is None or best < current:
                    track_type_counts[track_type]["bestLapMs"] = best

        for uid, racer in event_stats.merged_racers.items():
            total_racers.add(uid)
            total_laps += racer.total_lap_count
            total_valid_laps += racer.valid_lap_count

            if racer.best_lap_time_ms is not None:
                fastest_laps.append({
                    "username": racer.username or uid[:8],
                    "eventName": event_stats.event_name,
                    "trackType": track_type,
                    "lapTimeMs": racer.best_lap_time_ms,
                    "eventDate": event_stats.event_date,
                })

    fastest_laps.sort(key=lambda x: x["lapTimeMs"])
    fastest_laps = fastest_laps[:FASTEST_LAPS_MAX]

    global_stats = {
        "pk": "GLOBAL",
        "sk": "TOTALS",
        "totalEvents": total_events,
        "totalRacers": len(total_racers),
        "totalLaps": total_laps,
        "totalValidLaps": total_valid_laps,
        "totalCountries": len(countries),
        "eventsByCountry": [
            {"countryCode": cc, **data}
            for cc, data in sorted(events_by_country.items())
        ],
        "eventsByMonth": [
            {"month": m, **data}
            for m, data in sorted(events_by_month.items())
        ],
        "eventTypeBreakdown": [
            {"typeOfEvent": t, "count": c}
            for t, c in sorted(event_type_counts.items())
        ],
        "trackTypeBreakdown": [
            {"trackType": t, **data}
            for t, data in sorted(track_type_counts.items())
        ],
        "fastestLapsEver": fastest_laps,
    }

    stats_table.put_item(
        Item=dynamo_helpers.replace_floats_with_decimal(global_stats)
    )
    logger.info(f"Global stats written: {total_events} events, {len(total_racers)} racers")


def _scan_all_events() -> list[dict]:
    """Scan all events from the events table."""
    items = []
    response = events_table.scan()
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        response = events_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response["Items"])
    return items
