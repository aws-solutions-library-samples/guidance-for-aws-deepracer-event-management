"""Pure join logic for getCarRaceHistory (#66).

Given a chassis serial's CarsHistory activations (lineage rows from PR1) and the
race items, attribute each nested lap to the activation it was run under —
time-bounded by the activation window so a reused carName on a *different*
chassis is never miscounted.

No AWS calls live here; the index handler fetches the rows + races and passes
them in, so every branch is unit-testable in isolation.
"""

from __future__ import annotations

from datetime import datetime, timezone


def _parse_iso(value):
    """Parse an ISO-8601-ish timestamp to an aware datetime, or None.

    Tolerates a trailing 'Z', a space date/time separator, a date-only value,
    and a missing timezone (assumed UTC). Returns None for empty/unparseable
    input so callers treat it as 'no bound' / 'no match'.
    """
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    if "T" not in s and " " in s:
        s = s.replace(" ", "T", 1)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.fromisoformat(s[:10])  # date-only last resort
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def collect_paginated(page_fn):
    """Accumulate `Items` across DynamoDB pages.

    page_fn(exclusive_start_key) -> a boto3 response dict. Called with None
    first, then each LastEvaluatedKey until exhausted. Pure w.r.t. AWS — pass
    any callable in tests.
    """
    items = []
    start_key = None
    while True:
        resp = page_fn(start_key)
        items.extend(resp.get("Items", []))
        start_key = resp.get("LastEvaluatedKey")
        if not start_key:
            break
    return items


def build_activation_windows(history_rows):
    """CarsHistory rows -> time-bounded activation windows.

    Each kept row becomes {managedInstanceId, carName, frm, to}, where `frm` is
    the registrationDate (mandatory — the time bound is what makes the carName
    match safe, so rows without a parseable one are skipped) and `to` is the
    deregisteredAt (None = still active / open-ended).
    """
    windows = []
    for row in history_rows or []:
        car_name = row.get("carName")
        frm = _parse_iso(row.get("registrationDate"))
        if not car_name or frm is None:
            continue
        windows.append(
            {
                "managedInstanceId": row.get("managedInstanceId"),
                "carName": car_name,
                "frm": frm,
                "to": _parse_iso(row.get("deregisteredAt")),
            }
        )
    return windows


def match_activation(car_name, created_at, windows):
    """Return the activation window a lap belongs to, or None.

    A lap matches when its carName equals the window's and the race time falls
    in [frm, to] (to=None => open). If several windows match (shouldn't happen
    for one chassis — activations are sequential), the one with the latest frm
    wins (most specific).
    """
    created = _parse_iso(created_at)
    if created is None:
        return None
    best = None
    for w in windows:
        if w["carName"] != car_name:
            continue
        if created < w["frm"]:
            continue
        if w["to"] is not None and created > w["to"]:
            continue
        if best is None or w["frm"] > best["frm"]:
            best = w
    return best


def _lap_view(lap):
    """Project a raw lap dict to the public view shape.

    Returns: {lapId: str, time: Decimal|None, resets: int|None, isValid: bool}.
    `resets` is an integer reset count when present, otherwise None.
    """
    return {
        "lapId": lap.get("lapId"),
        "time": lap.get("time"),
        "resets": lap.get("resets"),
        "isValid": bool(lap.get("isValid")),
    }


def assemble_car_race_history(chassis_serial, history_rows, races):
    """Build the getCarRaceHistory payload.

    Laps are grouped by activation (managedInstanceId); a chassis-level summary
    is computed across all of them. Lap times may be Decimal — the caller
    converts Decimal->float on the way out; bestLapTime keeps the input type.
    """
    windows = build_activation_windows(history_rows)

    acts = {}
    for w in windows:
        acts[w["managedInstanceId"]] = {
            "managedInstanceId": w["managedInstanceId"],
            "carName": w["carName"],
            "from": w["frm"].isoformat(),
            "to": w["to"].isoformat() if w["to"] else None,
            "_races": {},  # raceId -> race view (dedup laps under one race)
        }

    for race in races or []:
        created_at = race.get("createdAt")
        for lap in race.get("laps") or []:
            w = match_activation(lap.get("carName"), created_at, windows)
            if w is None:
                continue
            bucket = acts[w["managedInstanceId"]]
            race_id = race.get("raceId") or race.get("sk") or f"__unknown_{id(race)}"
            rv = bucket["_races"].get(race_id)
            if rv is None:
                rv = {
                    "raceId": race_id,
                    "eventId": race.get("eventId"),
                    "trackId": race.get("trackId"),
                    "createdAt": created_at,
                    "laps": [],
                }
                bucket["_races"][race_id] = rv
            rv["laps"].append(_lap_view(lap))

    activations = []
    total_races = total_laps = total_valid = 0
    best_lap = None
    for act in acts.values():
        # Lexicographic ISO-string sort is correct: _parse_iso normalises all
        # timestamps to UTC (+00:00) and .isoformat() emits a fixed offset, so
        # string order equals chronological order.
        races_list = sorted(
            act["_races"].values(),
            key=lambda r: r.get("createdAt") or "",
            reverse=True,
        )
        lap_count = sum(len(r["laps"]) for r in races_list)
        activations.append(
            {
                "managedInstanceId": act["managedInstanceId"],
                "carName": act["carName"],
                "from": act["from"],
                "to": act["to"],
                "raceCount": len(races_list),
                "lapCount": lap_count,
                "races": races_list,
            }
        )
        total_races += len(races_list)
        total_laps += lap_count
        for r in races_list:
            for lap in r["laps"]:
                if lap["isValid"]:
                    total_valid += 1
                    t = lap["time"]
                    if t is not None and (best_lap is None or t < best_lap):
                        best_lap = t

    # Lexicographic sort is safe: all "from" values are UTC ISO strings (see above).
    activations.sort(key=lambda a: a["from"], reverse=True)
    return {
        "chassisSerial": chassis_serial,
        "summary": {
            "totalRaces": total_races,
            "totalLaps": total_laps,
            "totalValidLaps": total_valid,
            "bestLapTime": best_lap,
        },
        "activations": activations,
    }
