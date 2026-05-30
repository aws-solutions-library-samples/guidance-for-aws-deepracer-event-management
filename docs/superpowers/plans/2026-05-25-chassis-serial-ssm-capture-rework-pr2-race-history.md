# Chassis-Serial Rework PR2 — Cross-Hostname Race History (#66) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given a chassis serial, surface every lap the *physical car* ran across all the hostnames it's ever been activated under — time-bounded by the activation lineage so a reused hostname on a different chassis is never miscounted.

**Architecture:** A new `getCarRaceHistory(chassisSerial)` AppSync query resolved by the existing **`race_api`** Lambda (it already owns the race table, the scan primitives, and `replace_decimal_with_float`). The resolver reads the chassis's CarsHistory lineage (built in PR1), does a filtered scan of the race table, and joins nested-lap `carName` to each activation window `[registrationDate, deregisteredAt|now]`. All join logic lives in a pure, unit-tested module so it needs no AWS to test. The `CarHistoryModal` gains a "Race history" tab that renders a flat, most-recent-first table of laps across hostnames plus a chassis-level summary; event/track display names are resolved on the frontend (events store + `GetTrackTypeNameFromId`) so the backend stays free of cross-domain name lookups.

**Tech Stack:** Python 3.12 (AWS Lambda Powertools `AppSyncResolver`, boto3 DynamoDB) · AWS CDK (TypeScript, `awscdk-appsync-utils` code-first schema) · React + CloudScape + i18next · pytest · vitest · jest (CDK assertions).

**Builds on PR1 (already on `feat/car-chassis-serial`):** `CarsHistoryTable` (pk `chassisSerial`, sk `managedInstanceId`) carrying `carName`, `fleetId`, `fleetName`, `registrationDate`, `lastSeen`, `deregisteredAt`; the `getCarHistory` query/resolver; and `CarHistoryModal`. This plan does **not** modify the capture/poller/dedup path — only adds the race-history join + view on top of the lineage PR1 produces.

---

## File Structure

**Backend (new join logic + resolver):**
- `lib/lambdas/race_api/car_race_history.py` — **new.** Pure join logic (no AWS): ISO parsing, pagination accumulation, activation-window construction, lap→activation matching, payload assembly. One responsibility: turn `(chassisSerial, history_rows, races)` into the `CarRaceHistory` payload.
- `lib/lambdas/race_api/test_car_race_history.py` — **new.** Unit tests for the pure module.
- `lib/lambdas/race_api/index.py` — **modify.** Add the guarded `CarsHistoryTable` handle + the `getCarRaceHistory` resolver (thin glue over the pure module).
- `lib/lambdas/race_api/test_index.py` — **new.** One handler test (env + monkeypatched tables) proving the glue wires query→scan→assemble→Decimal-convert.

**CDK (wiring + schema):**
- `lib/constructs/cars-manager.ts` — **modify.** Expose the existing `CarsHistoryTable` as a public readonly property.
- `lib/constructs/race-manager.ts` — **modify.** Accept `carsHistoryTable` in props; grant `race_api` read + add `CARS_HISTORY_TABLE` env; declare the `CarRaceHistory*` GraphQL types + the `getCarRaceHistory` query on the existing `raceDataSource`.
- `lib/drem-app-stack.ts` — **modify.** Pass `carManager.carsHistoryTable` into `RaceManager`.
- `test/deepracer-event-manager.test.ts` — **modify.** Guard: the synthesised template contains the `getCarRaceHistory` resolver + new types.

**Frontend (query + view):**
- `website/src/graphql/queries.ts` — **modify.** Add the `getCarRaceHistory` query string.
- `website/src/components/carRaceHistory.ts` — **new.** Pure helper `flattenRaceHistory(data, eventsById)` + TS interfaces. One responsibility: response → flat, name-resolved, sorted table rows.
- `website/src/components/carRaceHistory.test.ts` — **new.** Unit tests for the flatten helper.
- `website/src/components/carHistoryModal.tsx` — **modify.** Wrap the existing lineage table + a new race-history tab in CloudScape `Tabs`; lazy-fetch race history when its tab opens; accept an `eventsById` prop.
- `website/src/admin/devices.tsx` — **modify.** Build `eventsById` from the events store and pass it to the modal.
- `website/public/locales/en/translation.json` — **modify.** New `devices.*` strings for the tab + summary + columns.

---

## Task 1: Pure join module (`car_race_history.py`)

**Files:**
- Create: `lib/lambdas/race_api/car_race_history.py`
- Test: `lib/lambdas/race_api/test_car_race_history.py`

- [ ] **Step 1: Write the failing tests**

Create `lib/lambdas/race_api/test_car_race_history.py`:

```python
from decimal import Decimal

import car_race_history as crh


def test_parse_iso_handles_z_offset_space_and_naive():
    assert crh._parse_iso("2026-05-25T10:00:00Z") is not None
    assert crh._parse_iso("2026-05-25T10:00:00+00:00") is not None
    assert crh._parse_iso("2026-05-25 10:00:00") is not None  # space separator
    assert crh._parse_iso("2026-05-25") is not None            # date only
    assert crh._parse_iso("") is None
    assert crh._parse_iso(None) is None
    assert crh._parse_iso("not-a-date") is None
    # naive input is treated as UTC and is comparable to aware input
    naive = crh._parse_iso("2026-05-25T10:00:00")
    aware = crh._parse_iso("2026-05-25T09:00:00Z")
    assert naive > aware


def test_collect_paginated_walks_all_pages():
    pages = [
        {"Items": [1, 2], "LastEvaluatedKey": {"k": "a"}},
        {"Items": [3], "LastEvaluatedKey": {"k": "b"}},
        {"Items": [4]},
    ]
    calls = []

    def page_fn(start_key):
        calls.append(start_key)
        return pages[len(calls) - 1]

    assert crh.collect_paginated(page_fn) == [1, 2, 3, 4]
    assert calls == [None, {"k": "a"}, {"k": "b"}]


def test_build_windows_skips_rows_without_registration_or_name():
    rows = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02"},          # no registrationDate → skip
        {"managedInstanceId": "mi-3", "registrationDate": "2026-03-01T00:00:00Z"},  # no carName → skip
    ]
    windows = crh.build_activation_windows(rows)
    assert [w["managedInstanceId"] for w in windows] == ["mi-1"]
    assert windows[0]["to"] is not None


def test_match_activation_is_time_bounded():
    rows = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02",
         "registrationDate": "2026-02-01T00:00:00Z", "deregisteredAt": None},
    ]
    windows = crh.build_activation_windows(rows)
    # in LGW01's window
    assert crh.match_activation("LGW01", "2026-01-15T00:00:00Z", windows)["managedInstanceId"] == "mi-1"
    # LGW02 open-ended window, far future still matches
    assert crh.match_activation("LGW02", "2099-01-01T00:00:00Z", windows)["managedInstanceId"] == "mi-2"
    # right name, wrong time (before LGW01 ever existed) → no match
    assert crh.match_activation("LGW01", "2025-01-01T00:00:00Z", windows) is None
    # name not in lineage → no match
    assert crh.match_activation("OTHER", "2026-01-15T00:00:00Z", windows) is None


def test_assemble_joins_two_hostnames_for_one_chassis():
    history = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02",
         "registrationDate": "2026-02-01T00:00:00Z", "deregisteredAt": None},
    ]
    races = [
        {"raceId": "r1", "eventId": "e1", "trackId": "1", "type": "race",
         "createdAt": "2026-01-10T00:00:00Z",
         "laps": [{"lapId": "l1", "carName": "LGW01", "time": Decimal("12.5"), "isValid": True},
                  {"lapId": "l2", "carName": "LGW01", "time": Decimal("99.9"), "isValid": False}]},
        {"raceId": "r2", "eventId": "e2", "trackId": "2", "type": "race",
         "createdAt": "2026-03-10T00:00:00Z",
         "laps": [{"lapId": "l3", "carName": "LGW02", "time": Decimal("11.0"), "isValid": True}]},
        # reused name on a DIFFERENT chassis, before LGW01's window → excluded
        {"raceId": "r3", "eventId": "e3", "trackId": "1", "type": "race",
         "createdAt": "2025-06-01T00:00:00Z",
         "laps": [{"lapId": "l4", "carName": "LGW01", "time": Decimal("5.0"), "isValid": True}]},
    ]
    out = crh.assemble_car_race_history("AMSS-9QCJ", history, races)
    assert out["chassisSerial"] == "AMSS-9QCJ"
    assert out["summary"]["totalRaces"] == 2          # r1 + r2, NOT r3
    assert out["summary"]["totalLaps"] == 3
    assert out["summary"]["totalValidLaps"] == 2
    assert out["summary"]["bestLapTime"] == Decimal("11.0")
    names = {a["carName"]: a for a in out["activations"]}
    assert names["LGW01"]["raceCount"] == 1 and names["LGW01"]["lapCount"] == 2
    assert names["LGW02"]["raceCount"] == 1 and names["LGW02"]["lapCount"] == 1
    # activations sorted most-recent-first by window start
    assert out["activations"][0]["carName"] == "LGW02"


def test_assemble_empty_lineage_returns_empty():
    out = crh.assemble_car_race_history("X", [], [{"raceId": "r1", "createdAt": "2026-01-01T00:00:00Z",
                                                   "laps": [{"carName": "LGW01", "time": Decimal("1")}]}])
    assert out["activations"] == []
    assert out["summary"] == {"totalRaces": 0, "totalLaps": 0, "totalValidLaps": 0, "bestLapTime": None}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd lib/lambdas/race_api && python -m pytest test_car_race_history.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'car_race_history'`.

- [ ] **Step 3: Write the module**

Create `lib/lambdas/race_api/car_race_history.py`:

```python
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
            race_id = race.get("raceId") or race.get("sk")
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd lib/lambdas/race_api && python -m pytest test_car_race_history.py -v`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/lambdas/race_api/car_race_history.py lib/lambdas/race_api/test_car_race_history.py
git commit -m "feat(cars): pure cross-hostname race-history join module (#66)"
```

---

## Task 2: `getCarRaceHistory` resolver glue in `race_api/index.py`

**Files:**
- Modify: `lib/lambdas/race_api/index.py`
- Test: `lib/lambdas/race_api/test_index.py` (create)

Context: `index.py` already has `app = AppSyncResolver()`, `ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)`, `RACE_TYPE = "race"`, `from boto3.dynamodb.conditions import Attr, Key`, and `import dynamo_helpers` (with `replace_decimal_with_float`). The module reads `DDB_TABLE` and `EVENT_BUS_NAME` as **required** env vars at import, so the test must set them (and a region) before importing, mirroring `lib/lambdas/car_status_update_function/test_index.py` from PR1.

- [ ] **Step 1: Write the failing handler test**

Create `lib/lambdas/race_api/test_index.py`:

```python
import os
import sys
from decimal import Decimal

# index.py builds boto3 resources + reads required env at import time.
os.environ.setdefault("AWS_DEFAULT_REGION", "eu-west-1")
os.environ.setdefault("DDB_TABLE", "race-table-test")
os.environ.setdefault("EVENT_BUS_NAME", "bus-test")
os.environ.setdefault("CARS_HISTORY_TABLE", "cars-history-test")
# dynamo_helpers ships as a Lambda layer; add it to the path for local import.
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "..", "lambda_layers", "helper_functions"),
)

import index  # noqa: E402


class _FakeTable:
    def __init__(self, items):
        self._items = items
        self.calls = []

    def query(self, **kwargs):
        self.calls.append(("query", kwargs))
        return {"Items": self._items}

    def scan(self, **kwargs):
        self.calls.append(("scan", kwargs))
        return {"Items": self._items}


def test_get_car_race_history_joins_and_converts_decimals(monkeypatch):
    history = [
        {"chassisSerial": "AMSS-9QCJ", "managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": None},
    ]
    races = [
        {"raceId": "r1", "eventId": "e1", "trackId": "1", "type": "race",
         "createdAt": "2026-01-10T00:00:00Z",
         "laps": [{"lapId": "l1", "carName": "LGW01", "time": Decimal("12.5"), "isValid": True}]},
    ]
    monkeypatch.setattr(index, "carsHistoryTable", _FakeTable(history))
    monkeypatch.setattr(index, "ddbTable", _FakeTable(races))

    out = index.getCarRaceHistory("AMSS-9QCJ")

    assert out["summary"]["totalRaces"] == 1
    assert out["activations"][0]["carName"] == "LGW01"
    # Decimal lap time must be converted to float for AppSync.
    assert isinstance(out["activations"][0]["races"][0]["laps"][0]["time"], float)


def test_get_car_race_history_empty_when_no_lineage(monkeypatch):
    monkeypatch.setattr(index, "carsHistoryTable", _FakeTable([]))
    monkeypatch.setattr(index, "ddbTable", _FakeTable([]))
    out = index.getCarRaceHistory("UNKNOWN")
    assert out["activations"] == []
    assert out["summary"]["totalRaces"] == 0
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lib/lambdas/race_api && python -m pytest test_index.py -v`
Expected: FAIL — `AttributeError: module 'index' has no attribute 'getCarRaceHistory'` (or `carsHistoryTable`).

- [ ] **Step 3: Add the guarded table handle + resolver**

In `lib/lambdas/race_api/index.py`, add the CarsHistory handle next to the existing `ddbTable` definition (just after the `ddbTable = dynamodb.Table(LAPS_DDB_TABLE_NAME)` line):

```python
CARS_HISTORY_TABLE_NAME = os.environ.get("CARS_HISTORY_TABLE")
carsHistoryTable = (
    dynamodb.Table(CARS_HISTORY_TABLE_NAME) if CARS_HISTORY_TABLE_NAME else None
)
```

Add the import near the other local imports (e.g. beside `import dynamo_helpers`):

```python
import car_race_history
```

Add the resolver (place it next to the existing `getRaces` resolver):

```python
@app.resolver(type_name="Query", field_name="getCarRaceHistory")
def getCarRaceHistory(chassisSerial):
    """#66: every lap a physical car ran across all its hostnames.

    Reads the chassis lineage (CarsHistory), scans the race table, and joins
    nested-lap carName to each activation window. On-demand admin/operator view
    — not a hot path (see the design doc's access-pattern note).
    """
    empty = {
        "chassisSerial": chassisSerial,
        "summary": {"totalRaces": 0, "totalLaps": 0, "totalValidLaps": 0, "bestLapTime": None},
        "activations": [],
    }
    if not chassisSerial or carsHistoryTable is None:
        return empty

    history_rows = car_race_history.collect_paginated(
        lambda start_key: carsHistoryTable.query(
            **{
                "KeyConditionExpression": Key("chassisSerial").eq(chassisSerial),
                **({"ExclusiveStartKey": start_key} if start_key else {}),
            }
        )
    )
    if not history_rows:
        return empty

    races = car_race_history.collect_paginated(
        lambda start_key: ddbTable.scan(
            **{
                "FilterExpression": Attr("type").eq(RACE_TYPE),
                **({"ExclusiveStartKey": start_key} if start_key else {}),
            }
        )
    )

    result = car_race_history.assemble_car_race_history(chassisSerial, history_rows, races)
    return dynamo_helpers.replace_decimal_with_float(result)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lib/lambdas/race_api && python -m pytest test_index.py test_car_race_history.py -v`
Expected: PASS — all tests pass. (Running both files in this single per-directory invocation is fine — no cross-directory `test_index.py` collision because only this directory is collected.)

- [ ] **Step 5: Commit**

```bash
git add lib/lambdas/race_api/index.py lib/lambdas/race_api/test_index.py
git commit -m "feat(cars): getCarRaceHistory resolver in race_api (#66)"
```

---

## Task 3: CDK wiring — grant `race_api` read on CarsHistory

**Files:**
- Modify: `lib/constructs/cars-manager.ts` (expose the table; class field area near line 43-47, assignment near the table creation ~line 292-296)
- Modify: `lib/constructs/race-manager.ts` (`RaceManagerProps` ~line 22; `raceLambda` env + grant ~line 81-92)
- Modify: `lib/drem-app-stack.ts` (`new RaceManager` props ~line 182)

- [ ] **Step 1: Expose `carsHistoryTable` on `CarManager`**

In `lib/constructs/cars-manager.ts`, add a public field alongside the existing public readonly declarations (near line 43-47):

```ts
  public readonly carsHistoryTable: dynamodb.Table;
```

Where the table is created (`const carsHistoryTable = new dynamodb.Table(this, 'CarsHistoryTable', { ... });`, ~line 292), add immediately after it:

```ts
    this.carsHistoryTable = carsHistoryTable;
```

(Leave every existing `carsHistoryTable.grant*` / env usage untouched — the local `const` still works.)

- [ ] **Step 2: Accept + wire the table in `RaceManager`**

In `lib/constructs/race-manager.ts`, add to the `RaceManagerProps` interface (~line 22, beside the other table props):

```ts
  carsHistoryTable: dynamodb.ITable;
```

In the `raceLambda` environment object (the `environment: { DDB_TABLE: raceTable.tableName, APPSYNC_URL: ... }` block, ~line 81), add:

```ts
        CARS_HISTORY_TABLE: props.carsHistoryTable.tableName,
```

After `raceTable.grantReadWriteData(raceLambda);` (~line 88), add:

```ts
    props.carsHistoryTable.grantReadData(raceLambda);
```

(`dynamodb` is already imported in this file — it constructs `dynamodb.Table` for the race table.)

- [ ] **Step 3: Pass the table from the stack**

In `lib/drem-app-stack.ts`, in the `new RaceManager(this, 'RaceManager', { ... })` call (~line 182), add to the props:

```ts
      carsHistoryTable: carManager.carsHistoryTable,
```

`carManager` is instantiated at line 164, before `RaceManager` at line 182, so the reference resolves.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/constructs/cars-manager.ts lib/constructs/race-manager.ts lib/drem-app-stack.ts
git commit -m "feat(cars): grant race_api read on CarsHistory for #66 join"
```

---

## Task 4: CDK schema — `CarRaceHistory*` types + `getCarRaceHistory` query + guard test

**Files:**
- Modify: `lib/constructs/race-manager.ts` (add types + query near the existing `raceObjectType` registration ~line 182 and the `getRaces` query ~line 314, using `raceDataSource` from ~line 92)
- Test: `test/deepracer-event-manager.test.ts` (add to the infrastructure-stack describe block that already asserts `ChassisSerialStatus` / `CARS_HISTORY_TABLE`, ~line 145-171)

Context: this file already imports `ObjectType`, `ResolvableField`, `GraphqlType`, `Directive` from `awscdk-appsync-utils`, and has `raceDataSource` (the `race_api` Lambda data source, ~line 92). The existing `getCarHistory` query uses `Directive.cognito('admin', 'operator')` — match that auth.

- [ ] **Step 1: Add the types + query**

In `lib/constructs/race-manager.ts`, after the `raceObjectType` is registered (after `props.appsyncApi.schema.addType(raceObjectType);`, ~line 182), add:

```ts
    // #66 — cross-hostname race history for a physical car (chassis serial).
    // Resolved by race_api: scans the race table, joins nested-lap carName to
    // the CarsHistory activation windows.
    const carRaceHistoryLapType = new ObjectType('CarRaceHistoryLap', {
      definition: {
        lapId: GraphqlType.id(),
        time: GraphqlType.float(),
        resets: GraphqlType.int(),
        isValid: GraphqlType.boolean(),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    const carRaceHistoryRaceType = new ObjectType('CarRaceHistoryRace', {
      definition: {
        raceId: GraphqlType.id(),
        eventId: GraphqlType.id(),
        trackId: GraphqlType.id(),
        createdAt: GraphqlType.awsDateTime(),
        laps: carRaceHistoryLapType.attribute({ isList: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    const carRaceHistoryActivationType = new ObjectType('CarRaceHistoryActivation', {
      definition: {
        managedInstanceId: GraphqlType.string(),
        carName: GraphqlType.string(),
        from: GraphqlType.awsDateTime(),
        to: GraphqlType.awsDateTime(),
        raceCount: GraphqlType.int(),
        lapCount: GraphqlType.int(),
        races: carRaceHistoryRaceType.attribute({ isList: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    const carRaceHistorySummaryType = new ObjectType('CarRaceHistorySummary', {
      definition: {
        totalRaces: GraphqlType.int(),
        totalLaps: GraphqlType.int(),
        totalValidLaps: GraphqlType.int(),
        bestLapTime: GraphqlType.float(),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    const carRaceHistoryType = new ObjectType('CarRaceHistory', {
      definition: {
        chassisSerial: GraphqlType.string(),
        summary: carRaceHistorySummaryType.attribute(),
        activations: carRaceHistoryActivationType.attribute({ isList: true }),
      },
      directives: [Directive.cognito('admin', 'operator')],
    });

    props.appsyncApi.schema.addType(carRaceHistoryLapType);
    props.appsyncApi.schema.addType(carRaceHistoryRaceType);
    props.appsyncApi.schema.addType(carRaceHistoryActivationType);
    props.appsyncApi.schema.addType(carRaceHistorySummaryType);
    props.appsyncApi.schema.addType(carRaceHistoryType);

    props.appsyncApi.schema.addQuery(
      'getCarRaceHistory',
      new ResolvableField({
        args: {
          chassisSerial: GraphqlType.string({ isRequired: true }),
        },
        returnType: carRaceHistoryType.attribute(),
        dataSource: raceDataSource,
        directives: [Directive.cognito('admin', 'operator')],
      })
    );
```

- [ ] **Step 2: Write the failing guard test**

In `test/deepracer-event-manager.test.ts`, inside the same `describe`/test block that asserts `ChassisSerialStatus` and `CARS_HISTORY_TABLE` (~line 145-171), add:

```ts
    // #66 — the cross-hostname race-history query + types must synthesise.
    template.hasResourceProperties('AWS::AppSync::Resolver', {
      FieldName: 'getCarRaceHistory',
      TypeName: 'Query',
    });
    expect(templateJson).toContain('CarRaceHistoryActivation');
```

(`templateJson` is the `template.toJSON()` string already used for the `ChassisSerialStatus` assertion in this block; reuse it.)

- [ ] **Step 3: Run the test to verify it fails (before re-synth) / passes (after)**

Run: `npm run build && npm test -- deepracer-event-manager`
Expected: PASS — the resolver and `CarRaceHistoryActivation` type are present in the synthesised template. (If you wrote the test before Step 1, it fails with the resolver/type missing; with Step 1 in place it passes.)

- [ ] **Step 4: Commit**

```bash
git add lib/constructs/race-manager.ts test/deepracer-event-manager.test.ts
git commit -m "feat(cars): getCarRaceHistory AppSync schema + synth guard (#66)"
```

---

## Task 5: Frontend GraphQL query string

**Files:**
- Modify: `website/src/graphql/queries.ts` (add beside the existing `getCarHistory` export, ~line 207)

- [ ] **Step 1: Add the query**

In `website/src/graphql/queries.ts`, after the `getCarHistory` export, add:

```ts
export const getCarRaceHistory = /* GraphQL */ `
  query getCarRaceHistory($chassisSerial: String!) {
    getCarRaceHistory(chassisSerial: $chassisSerial) {
      chassisSerial
      summary {
        totalRaces
        totalLaps
        totalValidLaps
        bestLapTime
      }
      activations {
        managedInstanceId
        carName
        from
        to
        raceCount
        lapCount
        races {
          raceId
          eventId
          trackId
          createdAt
          laps {
            lapId
            time
            resets
            isValid
          }
        }
      }
    }
  }
`;
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd website && npx tsc --noEmit`
Expected: exit 0 (the new export is a plain string; no errors introduced).

- [ ] **Step 3: Commit**

```bash
git add website/src/graphql/queries.ts
git commit -m "feat(cars): getCarRaceHistory query string (#66)"
```

---

## Task 6: Frontend flatten helper (`carRaceHistory.ts`) + test

**Files:**
- Create: `website/src/components/carRaceHistory.ts`
- Test: `website/src/components/carRaceHistory.test.ts`

Context: `GetTrackTypeNameFromId(id)` is exported from `website/src/admin/events/support-functions/raceConfig.ts` and returns the track display name (or `undefined`).

- [ ] **Step 1: Write the failing test**

Create `website/src/components/carRaceHistory.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../admin/events/support-functions/raceConfig', () => ({
  GetTrackTypeNameFromId: (id?: string | null) =>
    id === '1' ? 'reInvent 2018' : undefined,
}));

import { flattenRaceHistory } from './carRaceHistory';

const data = {
  chassisSerial: 'AMSS-9QCJ',
  summary: { totalRaces: 2, totalLaps: 3, totalValidLaps: 2, bestLapTime: 11.0 },
  activations: [
    {
      carName: 'LGW02',
      managedInstanceId: 'mi-2',
      races: [
        {
          raceId: 'r2', eventId: 'e2', trackId: '2', createdAt: '2026-03-10T00:00:00Z',
          laps: [{ lapId: 'l3', time: 11.0, resets: 0, isValid: true }],
        },
      ],
    },
    {
      carName: 'LGW01',
      managedInstanceId: 'mi-1',
      races: [
        {
          raceId: 'r1', eventId: 'e1', trackId: '1', createdAt: '2026-01-10T00:00:00Z',
          laps: [
            { lapId: 'l1', time: 12.5, resets: 1, isValid: true },
            { lapId: 'l2', time: 99.9, resets: 3, isValid: false },
          ],
        },
      ],
    },
  ],
};

const eventsById = { e1: { eventName: 'London GP' } }; // e2 deliberately absent

describe('flattenRaceHistory', () => {
  it('flattens laps across hostnames, resolves names, sorts newest first', () => {
    const rows = flattenRaceHistory(data as any, eventsById);
    expect(rows).toHaveLength(3);
    // newest race (LGW02, March) first
    expect(rows[0].hostName).toBe('LGW02');
    expect(rows[0].eventName).toBe('e2'); // falls back to eventId when not in store
    expect(rows[0].trackName).toBe('2'); // GetTrackTypeNameFromId undefined -> trackId
    const lgw01 = rows.filter((r) => r.hostName === 'LGW01');
    expect(lgw01[0].eventName).toBe('London GP'); // resolved from store
    expect(lgw01[0].trackName).toBe('reInvent 2018'); // resolved from util
    expect(lgw01.some((r) => r.isValid === false)).toBe(true);
  });

  it('returns [] for null data', () => {
    expect(flattenRaceHistory(null, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd website && npx vitest run src/components/carRaceHistory.test.ts`
Expected: FAIL — cannot resolve `./carRaceHistory`.

- [ ] **Step 3: Write the helper**

Create `website/src/components/carRaceHistory.ts`:

```ts
import { GetTrackTypeNameFromId } from '../admin/events/support-functions/raceConfig';

export interface CarRaceHistoryLap {
  lapId?: string;
  time?: number | null;
  resets?: number | null;
  isValid?: boolean | null;
}

export interface CarRaceHistoryRace {
  raceId?: string;
  eventId?: string;
  trackId?: string;
  createdAt?: string;
  laps?: CarRaceHistoryLap[];
}

export interface CarRaceHistoryActivation {
  managedInstanceId?: string;
  carName?: string;
  from?: string;
  to?: string | null;
  raceCount?: number;
  lapCount?: number;
  races?: CarRaceHistoryRace[];
}

export interface CarRaceHistorySummary {
  totalRaces?: number;
  totalLaps?: number;
  totalValidLaps?: number;
  bestLapTime?: number | null;
}

export interface CarRaceHistory {
  chassisSerial?: string;
  summary?: CarRaceHistorySummary;
  activations?: CarRaceHistoryActivation[];
}

export interface RaceHistoryRow {
  key: string;
  hostName: string;
  eventName: string;
  trackName: string;
  createdAt: string;
  lapTime: number | null;
  isValid: boolean;
}

type EventsById = Record<string, { eventName?: string } | undefined>;

/**
 * Flatten the getCarRaceHistory response into one row per lap, resolving the
 * event name (from the events store) and track name (from the shared track
 * util), sorted most-recent first. Pure — no network, fully unit-testable.
 */
export function flattenRaceHistory(
  data: CarRaceHistory | null | undefined,
  eventsById: EventsById
): RaceHistoryRow[] {
  const rows: RaceHistoryRow[] = [];
  for (const act of data?.activations ?? []) {
    for (const race of act.races ?? []) {
      const eventName = eventsById[race.eventId ?? '']?.eventName || race.eventId || '-';
      const trackName = GetTrackTypeNameFromId(race.trackId) || race.trackId || '-';
      for (const lap of race.laps ?? []) {
        rows.push({
          key: `${race.raceId ?? '?'}-${lap.lapId ?? '?'}`,
          hostName: act.carName || '-',
          eventName,
          trackName,
          createdAt: race.createdAt || '',
          lapTime: lap.time ?? null,
          isValid: Boolean(lap.isValid),
        });
      }
    }
  }
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd website && npx vitest run src/components/carRaceHistory.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add website/src/components/carRaceHistory.ts website/src/components/carRaceHistory.test.ts
git commit -m "feat(cars): flattenRaceHistory frontend helper (#66)"
```

---

## Task 7: Race-history tab in `CarHistoryModal` + `devices.tsx` wiring + i18n

**Files:**
- Modify: `website/src/components/carHistoryModal.tsx`
- Modify: `website/src/admin/devices.tsx` (passes `eventsById`; it already has `const [state, dispatch] = useStore();` at line 30 and renders `<CarHistoryModal .../>`)
- Modify: `website/public/locales/en/translation.json` (the `devices` object)

- [ ] **Step 1: Add i18n strings**

In `website/public/locales/en/translation.json`, add these keys to the `devices` object (next to the existing `car-history-*` keys):

```json
    "car-history-lineage-tab": "Activations",
    "car-history-races-tab": "Race history",
    "car-history-races-empty": "No races found for this car across its hostnames.",
    "car-history-total-races": "Total races",
    "car-history-total-laps": "Total laps",
    "car-history-best-lap": "Best lap",
    "car-history-col-event": "Event",
    "car-history-col-track": "Track",
    "car-history-col-date": "Date",
    "car-history-col-lap-time": "Lap time",
    "car-history-col-valid": "Valid"
```

- [ ] **Step 2: Pass `eventsById` from `devices.tsx`**

In `website/src/admin/devices.tsx`, build a lookup from the events store and pass it to the modal. Near the top of the component body (after `const [state, dispatch] = useStore();`):

```tsx
  const eventsById = React.useMemo(() => {
    const map: Record<string, { eventName?: string }> = {};
    for (const ev of state.events?.events ?? []) {
      if (ev?.eventId) map[ev.eventId] = { eventName: ev.eventName };
    }
    return map;
  }, [state.events?.events]);
```

(If `React` is not already imported as a namespace in this file, use the existing `useMemo` import instead, e.g. `const eventsById = useMemo(() => { ... }, [...]);`.)

Then add the prop to the existing `<CarHistoryModal ... />` usage:

```tsx
        eventsById={eventsById}
```

- [ ] **Step 3: Rebuild the modal with two tabs**

Replace the body of `website/src/components/carHistoryModal.tsx` with the version below. It keeps the existing lineage table verbatim (now in an "Activations" tab) and adds a lazily-fetched "Race history" tab built on `flattenRaceHistory`.

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Tabs,
  ColumnLayout,
} from '@cloudscape-design/components';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import { getCarHistory, getCarRaceHistory } from '../graphql/queries';
import { formatAwsDateTime } from '../support-functions/time';
import { flattenRaceHistory, CarRaceHistory, RaceHistoryRow } from './carRaceHistory';

interface CarHistoryEntry {
  chassisSerial: string;
  managedInstanceId: string;
  carName?: string | null;
  fleetId?: string | null;
  fleetName?: string | null;
  registrationDate?: string | null;
  lastSeen?: string | null;
  deregisteredAt?: string | null;
}

interface CarHistoryModalProps {
  visible: boolean;
  onDismiss: () => void;
  chassisSerial: string;
  eventsById: Record<string, { eventName?: string }>;
}

/**
 * Side-panel modal for one physical car (chassisSerial). Two tabs:
 *  - Activations: the managed-instance lineage (getCarHistory).
 *  - Race history: every lap across all hostnames, time-bounded by the
 *    lineage windows (getCarRaceHistory, #66). Lazily fetched on first open
 *    of the tab — it scans the race table, so we don't pay for it unless asked.
 */
const CarHistoryModal: React.FC<CarHistoryModalProps> = ({
  visible,
  onDismiss,
  chassisSerial,
  eventsById,
}) => {
  const { t } = useTranslation();
  const [activeTabId, setActiveTabId] = useState('lineage');

  // --- Activations (lineage) ---
  const [entries, setEntries] = useState<CarHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Race history (#66) ---
  const [raceHistory, setRaceHistory] = useState<CarRaceHistory | null>(null);
  const [racesLoading, setRacesLoading] = useState(false);
  const [racesError, setRacesError] = useState<string | null>(null);

  // Reset both panes whenever the modal opens for a (new) car.
  useEffect(() => {
    if (!visible) return;
    setActiveTabId('lineage');
    setRaceHistory(null);
    setRacesError(null);
  }, [visible, chassisSerial]);

  useEffect(() => {
    if (!visible || !chassisSerial) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries(null);

    graphqlQuery<{ getCarHistory: CarHistoryEntry[] }>(getCarHistory, { chassisSerial })
      .then((response) => {
        if (cancelled) return;
        const rows = [...(response.getCarHistory ?? [])].sort((a, b) => {
          const aKey = a.lastSeen || a.registrationDate || '';
          const bKey = b.lastSeen || b.registrationDate || '';
          return bKey.localeCompare(aKey);
        });
        setEntries(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('getCarHistory failed', err);
        setError(err?.message || 'Failed to load car history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, chassisSerial]);

  // Lazy-load race history only when its tab is opened.
  useEffect(() => {
    if (!visible || !chassisSerial) return;
    if (activeTabId !== 'races' || raceHistory || racesLoading) return;
    let cancelled = false;
    setRacesLoading(true);
    setRacesError(null);

    graphqlQuery<{ getCarRaceHistory: CarRaceHistory }>(getCarRaceHistory, { chassisSerial })
      .then((response) => {
        if (cancelled) return;
        setRaceHistory(response.getCarRaceHistory ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('getCarRaceHistory failed', err);
        setRacesError(err?.message || 'Failed to load race history');
      })
      .finally(() => {
        if (!cancelled) setRacesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, chassisSerial, activeTabId, raceHistory, racesLoading]);

  const raceRows: RaceHistoryRow[] = useMemo(
    () => flattenRaceHistory(raceHistory, eventsById),
    [raceHistory, eventsById]
  );

  const lineageTab = (
    <SpaceBetween size="m">
      {loading && (
        <Box textAlign="center" padding="m">
          <Spinner size="large" />
        </Box>
      )}
      {error && <StatusIndicator type="error">{error}</StatusIndicator>}
      {!loading && !error && entries && entries.length === 0 && (
        <StatusIndicator type="info">{t('devices.car-history-empty')}</StatusIndicator>
      )}
      {!loading && !error && entries && entries.length > 0 && (
        <Table
          variant="embedded"
          items={entries}
          trackBy="managedInstanceId"
          columnDefinitions={[
            { id: 'carName', header: t('devices.host-name'), cell: (item) => item.carName || '-' },
            { id: 'fleetName', header: t('devices.fleet-name'), cell: (item) => item.fleetName || '-' },
            { id: 'managedInstanceId', header: t('devices.instance'), cell: (item) => item.managedInstanceId },
            {
              id: 'registrationDate',
              header: t('devices.registration-date'),
              cell: (item) => formatAwsDateTime(item.registrationDate || '') || '-',
            },
            {
              id: 'deregisteredAt',
              header: t('devices.deregistered-at'),
              cell: (item) =>
                item.deregisteredAt
                  ? formatAwsDateTime(item.deregisteredAt) || '-'
                  : t('devices.car-history-active'),
            },
          ]}
        />
      )}
    </SpaceBetween>
  );

  const summary = raceHistory?.summary;
  const racesTab = (
    <SpaceBetween size="m">
      {racesLoading && (
        <Box textAlign="center" padding="m">
          <Spinner size="large" />
        </Box>
      )}
      {racesError && <StatusIndicator type="error">{racesError}</StatusIndicator>}
      {!racesLoading && !racesError && raceHistory && (
        <>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-total-races')}</Box>
              <div>{summary?.totalRaces ?? 0}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-total-laps')}</Box>
              <div>{summary?.totalLaps ?? 0}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">{t('devices.car-history-best-lap')}</Box>
              <div>{summary?.bestLapTime != null ? summary.bestLapTime.toFixed(3) : '-'}</div>
            </div>
          </ColumnLayout>
          {raceRows.length === 0 ? (
            <StatusIndicator type="info">{t('devices.car-history-races-empty')}</StatusIndicator>
          ) : (
            <Table
              variant="embedded"
              items={raceRows}
              trackBy="key"
              columnDefinitions={[
                { id: 'hostName', header: t('devices.host-name'), cell: (r) => r.hostName },
                { id: 'eventName', header: t('devices.car-history-col-event'), cell: (r) => r.eventName },
                { id: 'trackName', header: t('devices.car-history-col-track'), cell: (r) => r.trackName },
                {
                  id: 'date',
                  header: t('devices.car-history-col-date'),
                  cell: (r) => formatAwsDateTime(r.createdAt) || '-',
                },
                {
                  id: 'lapTime',
                  header: t('devices.car-history-col-lap-time'),
                  cell: (r) => (r.lapTime != null ? r.lapTime.toFixed(3) : '-'),
                },
                {
                  id: 'valid',
                  header: t('devices.car-history-col-valid'),
                  cell: (r) =>
                    r.isValid ? (
                      <StatusIndicator type="success" />
                    ) : (
                      <StatusIndicator type="stopped" />
                    ),
                },
              ]}
            />
          )}
        </>
      )}
    </SpaceBetween>
  );

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={t('devices.car-history-header')}
      size="large"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            {t('button.ok')}
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">
          {t('devices.chassis-serial')}: {chassisSerial}
        </Box>
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            { id: 'lineage', label: t('devices.car-history-lineage-tab'), content: lineageTab },
            { id: 'races', label: t('devices.car-history-races-tab'), content: racesTab },
          ]}
        />
      </SpaceBetween>
    </Modal>
  );
};

export { CarHistoryModal };
```

- [ ] **Step 4: Verify build + existing tests**

Run: `cd website && npm run build`
Expected: exit 0 (type-check + Vite build succeed).

Run: `cd website && npx vitest run src/components/carRaceHistory.test.ts src/components/devices-table/deviceTableConfig.test.ts`
Expected: PASS — both files green (the modal change doesn't touch `deviceTableConfig`, but run it to confirm no regression in the devices area).

- [ ] **Step 5: Commit**

```bash
git add website/src/components/carHistoryModal.tsx website/src/admin/devices.tsx website/public/locales/en/translation.json
git commit -m "feat(cars): race-history tab in CarHistoryModal (#66)"
```

---

## Final verification (run before opening/refreshing the PR)

- [ ] **Backend** — `cd lib/lambdas/race_api && python -m pytest -v` → all pass (per-directory run avoids the cross-dir `test_index.py` collision).
- [ ] **CDK build + tests** — from repo root: `npm run build && npm test` → tsc clean, jest green (includes the new `getCarRaceHistory` synth guard).
- [ ] **Website** — `cd website && npm run build` → exit 0; `npx vitest run` → green.
- [ ] **Manual deploy smoke (real data):** after deploy, open Devices → "View car history" on the validated chassis `AMSS-9QCJ`. The **Activations** tab shows the `DeepRacer01 → LGW01 → LGW99` lineage (from PR1's real-car test); the **Race history** tab, if any races were run under those hostnames inside their windows, lists them with event/track/date/lap-time and a chassis-level summary. A car with no captured serial shows no race-history (expected — no lineage window to bound the join).

---

## Notes / decisions baked in

- **Resolver lives in `race_api`, not `cars_function`.** The join is fundamentally a race-table scan + Decimal handling, which `race_api` already owns; it only needed a read grant on the (PR1) CarsHistory table. `CarManager` (stack line 164) precedes `RaceManager` (line 182), so the table reference flows forward with no construct reordering.
- **Time window source = `registrationDate` → `deregisteredAt|now`.** Both the capture Lambda (`register_car_serial`) and the poller's Gap-1 upsert (`car_status_update_function`, copies `RegistrationDate`) populate `registrationDate` on every row, so active and superseded activations are both bounded. Rows without a parseable `registrationDate` are deliberately **skipped** from the join (the time bound is what makes the `carName` match safe — per the spec, the window is mandatory).
- **Names resolved on the frontend** (events store + `GetTrackTypeNameFromId`) to keep `race_api` free of events-table/track-name coupling. The backend returns ids; the modal renders names with a graceful fallback to the id.
- **Lazy race-history fetch** — the scan only runs when the user opens the Race history tab, honouring the spec's "on-demand, not a hot path" constraint.
- **Cap impact:** one new `AWS::AppSync::Resolver` (+ a read-grant policy statement, not a counted resource). Negligible against the post-#255 headroom; the new `CarRaceHistory*` types are schema, not CFN resources.
- **Out of scope (per spec):** stamping `chassisSerial` onto laps at race time / restructuring laps into top-level items (forward-only optimisations); reconstructing activations whose serial was never captured (no window → their races stay unlinked).
```
