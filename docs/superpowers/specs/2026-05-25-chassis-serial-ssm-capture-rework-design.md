# Chassis-Serial Capture Rework — Server-Side SSM Pull (Design)

**Date:** 2026-05-25
**Status:** Design — pending implementation plan
**Supersedes:** the car-side capture mechanism in PR #234 (chassis-serial capture + dedup + history)

## Problem

PR #234 captures a car's chassis serial by having the car run, in `car_activation.sh`,
`aws lambda invoke` to call the `register_car_serial` Lambda. Real-car testing
(2026-05-24, community DeepRacer, Ubuntu 24.04) showed this can never work:

- The DeepRacer image has **no AWS CLI** (`aws: command not found`).
- Even with the CLI installed, a freshly-activated SSM **managed instance has no
  AWS credentials** for the CLI — only the SSM agent holds credentials.

The serial (`AMSS-9QCJ`) and managed-instance id were both read correctly and the
frontend emitted the right command; the `aws lambda invoke` simply failed silently
(the script suppresses its errors). Confirmed: **we cannot rely on any DeepRacer
having the AWS CLI or credentials.** The one component guaranteed present after
activation is the **SSM agent**.

## Terminology

- **Chassis serial** — the stable hardware id read off the device (e.g. `AMSS-9QCJ`
  on DeepRacer; the SoC serial on a Pi). Survives OS re-flash and hostname/fleet
  changes — the physical-car anchor.
- **`mi-xxxx`** — the **SSM managed-instance id**, assigned by SSM at activation
  (e.g. `mi-0de13203e135312ee`). A **new one each time the car is activated.**
  Already surfaced today as the optional **"Instance"** column in the Devices table
  and as a column in the car-history modal's lineage.
- **`carName`** — the hostname set at activation (e.g. `LGW01`); the value laps
  record at race time; **not** unique across physical cars (which is why #66's join
  must be time-bounded).

## Goals

1. Capture a stable hardware serial for every activated device **without** depending
   on the car having the AWS CLI or credentials.
2. Cover **both hardware types** — DeepRacer (x86/DMI) and Raspberry-Pi-based devices
   (ARM) — with a single device-agnostic capture.
3. Keep the activation lineage **complete and current**: a chassis serial (e.g.
   `AMSS-9QCJ`) maps to one record *per activation* — each holding that activation's
   managed-instance id (`mi-xxxx`), hostname, fleet, and
   `firstSeen`/`lastSeen`/`deregisteredAt` window — for *every* activation, including
   the currently-active one. (The serial is the stable hardware id; the `mi-xxxx`
   changes on each re-activation.)
4. Give each car an explicit serial **status** — the serial value, `Pending`, or
   `Unavailable` — surfaced in the UI rather than inferred from a blank cell.
5. Preserve the existing dedup + history-on-supersede behaviour.
6. Be **self-healing**: cars activated before this shipped, or that were offline at
   activation, get captured on a later poll cycle with no manual step or backfill.
7. **Cross-hostname race history (#66, folded in):** given a chassis serial, surface
   every lap the *physical car* ran across all the hostnames it's been activated
   under — time-bounded by the lineage windows.

## Non-goals

- Reconstructing long-retired / already-deregistered managed instances (no serial
  was ever captured for them).
- Stamping `chassisSerial` onto laps at race time, or restructuring laps into
  top-level items — both are forward-only / migration-heavy optimisations of the
  #66 join, noted under #66 but not built here.
- Per-event UI beyond the Devices column/filter + status badge and the car
  race-history view.

## Architecture

Flip the direction of capture. Instead of the **car calling out to AWS**, **DREM
reaches into the car** via SSM Run Command (which DREM already uses for status
updates and label printing) and reads the serial. The car is a pure SSM target.

```
car_status_update poll (existing, periodic)
   └─ per Online instance:
        read tags (existing)                ── ChassisSerial / lastSerialCheck
        derive serialStatus                 ── value | Pending | Unavailable
        if tagged:  upsert CarsHistory row   ── Gap-1 completeness (carName/fleet/lastSeen)
        if untagged & due: async-invoke ───────────► register_car_serial (capture)
                                                        SSM SendCommand (multi-source)
                                                        poll GetCommandInvocation
                                                        ├─ serial found → tag + dedup + history (existing core)
                                                        └─ empty       → set lastSerialCheck (→ Unavailable)
```

### Components & changes

1. **`website/public/car_activation.sh`** — remove the `aws lambda invoke` block
   (lines ~248–266) and the `-l <serialLambda>` plumbing (`-l` opt, `serialLambda`
   var). The car no longer touches AWS; it only registers the SSM agent. Also drop
   the now-dead `serialLambdaArg`/`registerCarSerialFunctionName` wiring in
   `website/src/admin/carActivationOriginal.tsx`. (The CFN output + config field may
   stay — harmless — but removing them keeps it tidy; decided in the plan.)

2. **`lib/lambdas/car_status_update_function/index.py`** (the existing poller) — in
   the per-instance loop, for an `Online` instance:
   - After `fetch_and_process_tags`, **derive `serialStatus`** (see below) and add it
     to the instance dict so `carsUpdateStatus` carries it.
   - If the instance **has** a `ChassisSerial` tag, **upsert** its CarsHistory row
     (`chassisSerial`, `managedInstanceId`, `carName`=ComputerName, `fleetId`,
     `fleetName`, `lastSeen`=now, `deregisteredAt`=absent). This is the **Gap-1**
     fix — the active activation is always complete in history, not only after it's
     superseded.
   - If the instance has **no** `ChassisSerial` tag **and** capture is due (no
     `lastSerialCheck` tag, or it's older than the back-off window), **async-invoke**
     (`InvocationType='Event'`) `register_car_serial` with `{managedInstanceId}`.
     Fire-and-forget so the poll stays fast.

3. **`lib/lambdas/register_car_serial/index.py`** (repurposed as the capture Lambda)
   — `chassisSerial` becomes **optional** in the input:
   - `{managedInstanceId, chassisSerial}` → existing path: tag + dedup + history
     (used by unit tests and manual invokes — unchanged).
   - `{managedInstanceId}` (no serial) → **fetch it first**: `ssm.send_command`
     with `AWS-RunShellScript` running the multi-source script (below), poll
     `ssm.get_command_invocation` until the command reaches a terminal state (cap
     ~30s), read `StandardOutputContent`, strip/validate.
     - serial found → existing tag + dedup + history core.
     - empty/placeholder → tag `lastSerialCheck=<now-iso>` only (no `ChassisSerial`);
       this drives the `Unavailable` status and the poll back-off.
   - On `SendCommand`/command **failure** (e.g. car went offline) → log, set **no**
     `lastSerialCheck` (leave it `Pending`), let the next poll retry.

4. **Frontend** (`devices-table/deviceTableConfig.tsx`, `devices.tsx`) — the
   ChassisSerial column renders: the serial value, or a **`Pending`** / **`Unavailable`**
   badge derived from `serialStatus`. "View car history" stays enabled only when a
   real serial is present. The existing chassisSerial filter continues to let an
   operator list cars by serial / find the gaps.

5. **Unchanged:** `CarsHistoryTable` (pk `chassisSerial`, sk `managedInstanceId`),
   `getCarHistory` query + resolver, `CarHistoryModal`, the dedup logic, and the
   history-on-supersede write.

### Multi-hardware serial source

The SSM command is one shell snippet that tries sources in order and echoes the
first non-empty, non-placeholder value:

```sh
read_serial() {
  # DeepRacer (x86, DMI)
  v=$(tr -d '\0' < /sys/class/dmi/id/chassis_serial 2>/dev/null | tr -d '[:space:]')
  case "$v" in ""|"Defaultstring"|"ToBeFilledByO.E.M."|"0000000000000000"|"None") ;; *) echo "$v"; return;; esac
  # Raspberry Pi (ARM) — same SoC serial via two paths
  v=$(tr -d '\0' < /sys/firmware/devicetree/base/serial-number 2>/dev/null | tr -d '[:space:]')
  case "$v" in ""|"0000000000000000") ;; *) echo "$v"; return;; esac
  v=$(awk '/^Serial/{print $3}' /proc/cpuinfo 2>/dev/null | tr -d '[:space:]')
  case "$v" in ""|"0000000000000000") ;; *) echo "$v";; esac
}
read_serial
```

- `chassis_serial` covers DeepRacer (x86, DMI). We deliberately do **not** fall back
  to `product_serial` / `board_serial` — they are *different* DMI fields with
  different values, so substituting one would capture an inconsistent identifier for
  the same physical car (and could change between activations). An empty / placeholder
  `chassis_serial` on an x86 device is reported **Unavailable**, never swapped.
- `devicetree/base/serial-number` (primary) / `/proc/cpuinfo` `Serial` (path fallback —
  the *same* RPi SoC serial, just exposed differently across OS versions) cover
  Raspberry Pi (ARM, no DMI). x86 and ARM sources are mutually exclusive per device,
  so they can't conflict. This also absorbs the RPi-serial dedup idea (#69).
- Known placeholders are filtered so a bogus value never becomes a dedup anchor.

The Lambda re-validates the returned value (non-empty, not a placeholder) before
tagging.

### Serial status derivation (poller)

| Tags on the instance | `serialStatus` | Capture action |
|---|---|---|
| `ChassisSerial` present | the serial value | none (upsert history) |
| no `ChassisSerial`, `lastSerialCheck` present | `Unavailable` | retry only if `lastSerialCheck` older than back-off (e.g. 1h) |
| no `ChassisSerial`, no `lastSerialCheck` | `Pending` | invoke capture now |

### IAM

- **`car_status_update_function` role** — add `lambda:InvokeFunction` on
  `register_car_serial` and write access to `CarsHistoryTable`. (Already has
  `ssm:ListTagsForResource` / inventory + AppSync mutation.)
- **`register_car_serial` role** — add `ssm:SendCommand` (scoped to the
  `AWS-RunShellScript` document + the managed instances) and
  `ssm:GetCommandInvocation`. Keep existing `ssm:AddTagsToResource`,
  `ssm:DeregisterManagedInstance`, `tag:GetResources`, DDB read/write.
- **Remove** `register_car_serial_handler.grantInvoke(ssmRunCommandRole)` — the car
  no longer invokes the Lambda.

## Error handling

All capture work is best-effort and **must never block** the status-update poll:
- `SendCommand` throttled / instance offline → log + skip; left `Pending`, retried.
- Command runs, output empty/placeholder → `lastSerialCheck` set → `Unavailable`,
  retried on the back-off (hardware/source may change, e.g. an OS rebuild).
- DDB / tagging errors → log + continue (mirrors the existing best-effort pattern).
- Capture is idempotent: a car already tagged is skipped; dedup re-running is safe.

## Consequence to surface

A car with **no serial has no dedup anchor** — re-activating it produces a *duplicate*
`mi-xxxx` (no old instance to deregister) and its history won't link until a serial is
captured. This is exactly why the explicit `Unavailable`/`Pending` status (and the
existing filter) matter operationally — the gap is visible, not silent. The
self-healing poll keeps the window short.

## Cross-hostname race history (#66, folded in)

**Goal:** given a chassis serial, show every lap the *physical car* ran across all
the hostnames it's been activated under (e.g. `LGW01` then, after a re-flash,
`LGW02`).

**The join — time-bounded.** A new `getCarRaceHistory(chassisSerial)` query/resolver:
1. Reads CarsHistory for the chassis → its activations
   `[{ carName, from = registrationDate/firstSeen, to = deregisteredAt | now }]`.
2. Gathers every lap where `lap.carName == activation.carName` **and** the race's
   `createdAt ∈ [from, to]` for that activation.
3. Returns the laps grouped by activation (hostname) plus a chassis-level summary
   (total laps/races, best lap across all hostnames), each lap carrying event,
   track, time and date.

**Why the time window is mandatory:** `carName` is **not** a unique physical-car
key — names are reused (a *different* chassis can later be named `LGW01`). Matching
`carName` alone would pull in another car's races. Bounding each `carName` match to
the activation's `[from, to]` window — which the lineage records — disambiguates.

**Access pattern — the real constraint.** Laps are **nested inside `Race` items**
and the race table (`pk`/`sk` single-table) has **no index on `carName`**, so there
is no cheap query by car. The join is therefore a **filtered scan** of the race
table — filter by the union of the chassis's time windows, then match nested-lap
`carName`. Acceptable because this is an **on-demand, cacheable admin/stats view**
with modest per-deployment race volume; it is explicitly **not** a hot path.
Documented ceiling: very large race volumes would need optimisation.

**Rejected cheaper approaches (and why):**
- *GSI on `carName`* — impossible; `carName` is nested in the laps list, not a
  top-level attribute.
- *Stamp `chassisSerial` on laps at race time* (timekeeper) — makes it a direct
  query, but **forward-only**: it can't link the *historical* races that are the
  whole point ("going back in time"). A future optimisation, not this effort.
- *Restructure laps into top-level items* — a data migration, out of scope.

**UI:** extend `CarHistoryModal` — alongside the activation lineage it gains the
races per activation (hostname → laps: time / event / track / date) and the
chassis-level summary. Shape is adjustable at review.

**Forward-only caveat (restated):** only races whose `carName` + time fall inside a
*captured* activation window are linked. Activations whose serial was never captured
contribute no window, so their races stay unlinked to the chassis.

**Implementation staging:** designed as one spec, but recommended to **ship in two
PRs** for reviewability — (1) the capture rework + lineage completeness + status
(the foundation; independently testable on a real car), then (2) the #66
`getCarRaceHistory` query + the modal view (built on the foundation's lineage).

## Testing

- **Multi-source parse** — given representative `cat`/`awk` outputs (DeepRacer DMI,
  RPi devicetree, RPi cpuinfo, empty, placeholder, all-zeros), the source-selection
  picks the right value or returns empty.
- **Capture Lambda** — mock `ssm.send_command` + `ssm.get_command_invocation`:
  serial found → tags + dedups + history; empty → `lastSerialCheck` set, no
  `ChassisSerial`; command failure → no tags, no crash. Existing
  `{miId, serial}` core tests stay green.
- **Status derivation** — the three tag combinations map to value / `Pending` /
  `Unavailable`, and the back-off gate (invoke vs skip).
- **Poller** — untagged-online-and-due → invoke fired; tagged → history upserted with
  carName/fleet/lastSeen; capture errors never break the status update.
- **#66 join** — given a synthetic CarsHistory lineage (`LGW01` window A, `LGW02`
  window B for one chassis) and race fixtures, the join returns laps from both
  hostnames; a same-`carName`-different-chassis race *outside* the window is
  **excluded** (time-bounding works); a race with a matching name *inside* the
  window is included; empty lineage → empty result.

## Out of scope / follow-ups

- **Future #66 optimisation** — if race volume ever outgrows the filtered scan,
  stamp `chassisSerial` onto laps at race time (timekeeper) and/or restructure laps
  into top-level items with a `chassisSerial` index, turning the join into a direct
  query. Forward-only, so it complements (doesn't replace) the historical join.
- This design renders **#69** (RPi-timer serial dedup) largely moot for capture — the
  multi-source command already reads RPi serials; #69 becomes "confirm RPi timers
  flow through the same path."
