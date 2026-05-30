# Pico W Galactic Unicorn Race Display — Design Spec

**Date:** 2026-03-22
**Branch:** `feat/pico-display`
**Hardware:** Raspberry Pi Pico W + Pimoroni Galactic Unicorn (53×11 LED matrix)

---

## Overview

A MicroPython application running on a Pico W that connects to a live DREM deployment and displays race information on a Pimoroni Galactic Unicorn LED matrix. The display shows a scrolling leaderboard ticker when idle and switches to a live race data scroll when a race is in progress, driven by real-time AppSync data.

---

## Repository Location

```
pico-display/
├── main.py              # entry point, boots wifi, launches async tasks
├── config.json          # user config (wifi, appsync, event, display prefs)
├── config.py            # loads and validates config.json
├── wifi.py              # wifi connect/reconnect with retry
├── display.py           # Galactic Unicorn driver: scrolling, modes, flash
├── leaderboard.py       # HTTP poll → getLeaderboard query every N seconds
├── race.py              # WebSocket → onNewOverlayInfo subscription
└── README.md            # hardware setup and configuration guide
```

---

## Architecture

Three `uasyncio` tasks run concurrently on the Pico W:

| Task | Responsibility |
|------|---------------|
| `display_task` | Scrolls text at configured speed; switches between idle/race/branding modes; reads from shared `State` |
| `race_task` | Maintains WebSocket connection to AppSync; subscribes to `onNewOverlayInfo`; writes race state to `State` |
| `leaderboard_task` | HTTP polls AppSync `getLeaderboard` query every N seconds; writes leaderboard list to `State` |

A single shared `State` object (plain Python object — no locking required on single-core MicroPython) is written by the network tasks and read by `display_task` on every scroll tick. There is no direct coupling between network tasks and the display.

---

## Configuration (`config.json`)

```json
{
  "wifi": {
    "ssid": "YourNetwork",
    "password": "YourPassword"
  },
  "appsync": {
    "endpoint": "https://xxxxx.appsync-api.eu-west-1.amazonaws.com/graphql",
    "api_key": "da2-xxxxxxxxxxxxxxxxxx",
    "region": "eu-west-1"
  },
  "event": {
    "event_id": "d4430f0e-863b-4cdd-a8b2-1224bf60eeb3",
    "track_id": "1",
    "race_format": "fastest"
  },
  "display": {
    "brightness": 0.5,
    "scroll_speed": 40,
    "leaderboard_poll_interval": 30,
    "leaderboard_top_n": 5,
    "race_items": [
      "time_remaining",
      "laps_completed",
      "fastest_lap",
      "last_lap",
      "resets"
    ]
  }
}
```

**Validation rules (enforced by `config.py` — any failure halts with `CONFIG ERROR`):**
- `event.event_id` — required
- `event.track_id` — required; sent as the `trackId` variable in the subscription (may be omitted from the query to receive all tracks, but the config field is mandatory to avoid ambiguity)
- `event.race_format` — required; must be exactly `"fastest"` or `"average"`; any other value is a fatal config error
- `appsync.endpoint`, `appsync.api_key`, `appsync.region` — all required

**Notes:**
- `race_items` controls which data fields appear in the race scroll and their order. Removing an item from the list drops it entirely. Items are separated by a `·` divider on the display.
- `race_format` controls leaderboard sort order only: `"fastest"` sorts by fastest single lap time, `"average"` sorts by average lap time. The idle ticker always displays `fastest_lap_ms` regardless of format.
- `scroll_speed` is in pixels per second — higher values scroll faster. 40 is a comfortable default for race-side viewing distance.
- `leaderboard_top_n` controls how many entries to show in the idle ticker. Filtering is client-side; the API returns all entries and the Pico takes the top N after sorting.
- A future DREM UI feature will allow generating `config.json` from the DREM admin interface, eliminating manual file editing.

---

## Display Modes

### Idle — cycles on a 10s timer between:

1. **Branding screen** — event name centred on the display, static or slow brightness pulse. Uses `State.event_name` when non-None; falls back to `State.leaderboard_title` (from `getLeaderboard` config response) before the first subscription message arrives. `State.event_name` is initialised to `None` at boot.
2. **Leaderboard ticker** — scrolls top N racers, always showing fastest lap time:
   ```
   #1 DAVE 12.345s  ·  #2 ALICE 13.012s  ·  #3 BOB 14.220s →
   ```

**Status transitions:**

| Incoming `raceStatus` | Current mode | Action |
|----------------------|--------------|--------|
| `READY_TO_START`, `RACE_IN_PROGRESS`, `RACE_PAUSED` | Idle | Switch to Race mode |
| `READY_TO_START`, `RACE_IN_PROGRESS`, `RACE_PAUSED` | Race | Stay in Race mode (update data) |
| `RACE_FINISHED` | Race | Flash best lap 5s (green), then return to Idle |
| `RACE_SUBMITTED` | Race | Flash `State.race["fastest_lap_ms"]` 5s (green), then return to Idle. If `fastest_lap_ms` is None (RACE_FINISHED was never received), skip the flash and return directly to Idle. |
| `NO_RACER_SELECTED` | Any | Return to Idle immediately; clear `State.race` |

### Race — single scrolling line

Built from the configured `race_items` list, e.g.:
```
⏱ 02:34  ·  3 laps  ·  best 12.345s  ·  last 13.210s  ·  2 resets →
```

**Colour coding:**

| Data item | Colour |
|-----------|--------|
| Time remaining | Yellow |
| Laps completed | Cyan |
| Fastest lap | Green |
| Last lap | White |
| Resets | Orange |

**Reset flash** — when the `resets` count increments (derived by summing `resets` across all laps), the display flashes orange for 500 ms before resuming normal scroll. This is a fixed wall-clock duration, independent of scroll speed or string length.

---

## Data Flow

### Leaderboard (HTTP polling)

```
leaderboard_task
  → POST to AppSync /graphql endpoint
  → query: getLeaderboard(eventId, trackId)
  → headers: { x-api-key: <api_key> }
  → store config.leaderBoardTitle in State.leaderboard_title
  → parse entries:
      fastest_lap_ms = int(round(entry["fastestLapTime"])) if entry["fastestLapTime"] else None
  → sort ascending:
      "fastest" format: key = fastest_lap_ms (None sorts last)
      "average" format: key = int(round(entry["avgLapTime"])) if avgLapTime is not None else float("inf")
  → assign position: 1-based rank in the full sorted list (before slicing)
  → take top leaderboard_top_n entries (client-side)
  → write to State.leaderboard[]
  → sleep leaderboard_poll_interval seconds, repeat
```

**Unit note:** `fastestLapTime` and `avgLapTime` are stored and returned in **milliseconds** (confirmed: the timekeeper stores `laps[].time = getCurrentTimeInMs()` and the leaderboard Lambda derives these directly from `laps[].time`). Divide by 1000 for display.

### Race (WebSocket subscription)

AWS AppSync real-time subscriptions use the **`graphql-ws`** WebSocket subprotocol (not `graphql-transport-ws`). Message types are `connection_init` / `connection_ack` / `start` / `data` / `ka` (keep-alive). For API_KEY auth, the connection URL includes base64url-encoded `header` and `payload` query parameters:

```
wss://xxxxx.appsync-realtime-api.<region>.amazonaws.com/graphql
  ?header=<base64url({"host":"xxxxx.appsync-api.<region>.amazonaws.com","x-api-key":"<api_key>"})>
  &payload=<base64url({})>
```

Connection sequence:
1. Open WebSocket with `Sec-WebSocket-Protocol: graphql-ws`
2. Send `connection_init`: `{"type": "connection_init"}`
3. Await `connection_ack`
4. Send `start` to begin the subscription:
   ```json
   {
     "id": "1",
     "type": "start",
     "payload": {
       "query": "subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) { onNewOverlayInfo(eventId: $eventId, trackId: $trackId) { eventId eventName trackId username raceStatus timeLeftInMs currentLapTimeInMs laps { lapId time isValid resets } countryCode } }",
       "variables": { "eventId": "<event_id>", "trackId": "<track_id>" }
     }
   }
   ```
5. Process incoming `data` messages matched by `id`; ignore `ka` messages silently. Extract payload via `message["payload"]["data"]["onNewOverlayInfo"]`.

```
race_task
  → connect (URL above), subprotocol: graphql-ws
  → send connection_init, await connection_ack
  → send start message (see above)
  → on data message:
      → extract raceStatus, timeLeftInMs, currentLapTimeInMs, laps[], username, eventName
      → if eventName is non-empty string: State.event_name = eventName
      → dispatch on raceStatus:
          NO_RACER_SELECTED  → clear State.race, signal idle
          RACE_FINISHED      → derive final data, write to State.race, signal race-finished flash
          RACE_SUBMITTED     → signal race-submitted flash (use existing State.race["fastest_lap_ms"])
          otherwise          → derive and write to State.race
      → derivations (for READY_TO_START / RACE_IN_PROGRESS / RACE_PAUSED / RACE_FINISHED):
          resets = sum(lap["resets"] for lap in laps)  # resets is Int per lap
          valid_times = [lap["time"] for lap in laps if lap["isValid"] is True]
          fastest_lap_ms = int(round(min(valid_times))) if valid_times else None
          valid_laps_in_order = [lap for lap in laps if lap["isValid"] is True]
          # laps[] is in chronological insertion order as sent by the timekeeper; no reordering occurs
          last_lap_ms = int(round(valid_laps_in_order[-1]["time"])) if valid_laps_in_order else None
          time_left_ms = int(timeLeftInMs)  # Float schema type, ms value
  → on disconnect:
      → retain State.race (display continues showing last known data)
      → if no data received for >10s: show RECONNECTING... indicator
      → exponential backoff reconnect: 2s → 4s → 8s → cap 60s
```

**Unit note:** `laps[].time` is in **milliseconds** (confirmed: timekeeper stores `time = getCurrentTimeInMs()`). `timeLeftInMs` and `currentLapTimeInMs` are in milliseconds despite being `Float` schema type. No multiplication needed — cast to `int()` only.

### Shared State object

```python
# Initialised at boot:
State.event_name = None              # populated from eventName in subscription; None until first non-empty value
State.leaderboard_title = ""         # populated from getLeaderboard config.leaderBoardTitle on first poll
State.leaderboard = []
State.race = None                    # None = not in a race; set to dict when race active

# State.race when a race is active:
State.race = {
    "status": "RACE_IN_PROGRESS",   # NO_RACER_SELECTED / READY_TO_START / RACE_IN_PROGRESS / RACE_PAUSED / RACE_FINISHED / RACE_SUBMITTED
    "username": "DAVE",
    "time_left_ms": 154000,         # int ms, from timeLeftInMs (Float in schema, value is ms)
    "laps": [...],                  # full laps array; each lap: lapId, time (float ms), isValid (bool), resets (int)
    "resets": 2,                    # derived: sum of lap["resets"] across all laps
    "fastest_lap_ms": 12450,        # derived: int(round(min valid lap time)); None if no valid laps yet
    "last_lap_ms": 13210,           # derived: int(round(last valid lap by chronological array position)); None if no valid laps yet
}

# State.leaderboard entries:
State.leaderboard = [
    {
        "username": "DAVE",
        "fastest_lap_ms": 12450,    # int(round(fastestLapTime)); None if no valid laps
        "position": 1,              # 1-based rank in full sorted board before top_n slice
    },
    ...
]
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| WiFi unavailable on boot | Retry up to 10× with 2s delay; display `CONNECTING...` in white |
| WiFi drops mid-session | Display `NO WIFI` in red; retry on 5s backoff; resume when reconnected |
| WebSocket disconnected | Retain stale `State.race`; show `RECONNECTING...` if no data for >10s; exponential backoff reconnect |
| HTTP poll fails | Skip update; retain stale leaderboard; retry next interval |
| `config.json` missing/malformed | Display `CONFIG ERROR` in red; halt — fail loudly |
| Unknown `race_format` value | Display `CONFIG ERROR` in red; halt |
| Unexpected crash | Display exception on LEDs; hard-reset after 10s for self-recovery |

---

## AppSync GraphQL Queries

**Leaderboard query** (`getLeaderboard`):
```graphql
query GetLeaderboard($eventId: ID!, $trackId: ID) {
  getLeaderboard(eventId: $eventId, trackId: $trackId) {
    config { leaderBoardTitle }
    entries {
      username
      fastestLapTime
      avgLapTime
      numberOfValidLaps
      countryCode
    }
  }
}
```

`fastestLapTime` and `avgLapTime` are floats in **milliseconds** (e.g. `12450.0` = 12.450 s). `avgLapTime` is nullable — sort `None` entries to the end. Store as `int(round(...))`.

**Race subscription** (`onNewOverlayInfo`):
```graphql
subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) {
  onNewOverlayInfo(eventId: $eventId, trackId: $trackId) {
    eventId eventName trackId
    username raceStatus
    timeLeftInMs currentLapTimeInMs
    laps { lapId time isValid resets }
    countryCode
  }
}
```

`laps[].time` is a float in **milliseconds**. `timeLeftInMs` and `currentLapTimeInMs` are floats in **milliseconds** despite the `Float` GraphQL schema type — cast to `int()`, no conversion needed.

Both queries use **API_KEY** authentication (`x-api-key` header for HTTP; base64url-encoded in the WebSocket URL `header` query param for subscriptions).

---

## DREM Companion Page

A page in the DREM admin portal that surfaces the information needed to configure a Pico display and lets the operator download a ready-to-use `config.json`. Follows the same pattern as the Timer Activation and Car Activation pages.

### Location in the portal

- **Route:** `/admin/pico_display`
- **File:** `website/src/admin/picoDisplay.tsx`
- **Nav group:** Device Management — alongside Car Activation and Timer Activation
- **Nav label:** `Pico LED Display` with a `Beta` badge (`<Badge color="blue">Beta</Badge>`)

### API key availability

The AppSync API key is currently only written to the leaderboard's `config.json`. It must also be added to the main website's Amplify config so the admin page can read it:

1. Update `scripts/generate_amplify_config_cfn.py` to read `appsyncApiKey` from `cfn.outputs` and write it to `website/src/config.json` as `aws_appsync_apiKey`
2. The page then reads it via the existing `awsconfig` import

### Page layout

The page has two containers, matching the style of other activation pages.

**Container 1 — Connection details**

Read-only fields populated from `awsconfig` (endpoint, region, API key). Each field has a copy-to-clipboard button.

| Field | Source |
|-------|--------|
| AppSync Endpoint | `awsconfig.aws_appsync_graphqlEndpoint` |
| Region | `awsconfig.aws_appsync_region` |
| API Key | `awsconfig.aws_appsync_apiKey` |

**Container 2 — Generate config**

A form the operator fills in before downloading. Pre-populated from the event store where available.

| Field | Type | Source / Default |
|-------|------|-----------------|
| Event | Select | Event selector using `eventsStore`; required |
| Track | Select | Tracks from the selected event; required |
| Race Format | Select (`fastest` / `average`) | Defaults to `fastest` |
| Brightness | Number (0.0–1.0) | Default `0.5` |
| Scroll Speed (px/s) | Number | Default `40` |
| Leaderboard Poll Interval (s) | Number | Default `30` |
| Leaderboard Top N | Number | Default `5` |

The wifi section (`ssid` / `password`) is intentionally excluded — the operator enters those directly on the Pico before deploying.

**Download config.json** button — generates `config.json` client-side from the form values and the connection details, then triggers a browser download. No server round-trip needed.

**Get the code** section — a link to the `pico-display/` directory in the GitHub repository, with brief instructions (clone or download zip, copy `config.json` into the directory, flash to Pico with Thonny).

### i18n

Add keys for all new strings in `website/src/i18n/` following the existing pattern (en only for now; other languages can follow).

---

## Future Work

- **`race_format` from event data** — derive fastest/average from AppSync event rather than config
- **Additional Unicorn variants** — Cosmic Unicorn (32×32) and Stellar Unicorn (16×16) support with alternative display layouts
- **OTA config** — Pico polls a known URL for config updates, enabling remote reconfiguration without USB access
