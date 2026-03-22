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

**Notes:**
- `race_items` controls which data fields appear in the race scroll and their order. Removing an item from the list drops it entirely. Items are separated by a `·` divider on the display.
- `race_format` is a config-time setting for now. A future follow-on will derive it from AppSync event data directly.
- A future DREM UI feature will allow generating `config.json` from the DREM admin interface, eliminating manual file editing.

---

## Display Modes

### Idle — cycles on a 10s timer between:

1. **Branding screen** — event name centred on the display, static or slow brightness pulse
2. **Leaderboard ticker** — scrolls top N racers:
   ```
   #1 DAVE 12.34s  ·  #2 ALICE 13.01s  ·  #3 BOB 14.22s →
   ```

Transition to race mode is triggered when `raceStatus` transitions to `READY_TO_START`, `RACE_IN_PROGRESS`, or `RACE_PAUSED`.

### Race — single scrolling line

Built from the configured `race_items` list, e.g.:
```
⏱ 02:34  ·  3 laps  ·  best 12.45s  ·  last 13.21s  ·  2 resets →
```

**Colour coding:**

| Data item | Colour |
|-----------|--------|
| Time remaining | Yellow |
| Laps completed | Cyan |
| Fastest lap | Green |
| Last lap | White |
| Resets | Orange |

**Reset flash** — when the `resets` count increments, the display flashes orange for 1–2 scroll cycles before resuming normal scroll.

**Race finished** — `RACE_FINISHED` status triggers a 5-second flash of the racer's best lap time in green, then returns to idle mode.

---

## Data Flow

### Leaderboard (HTTP polling)

```
leaderboard_task
  → POST to AppSync /graphql endpoint
  → query: getLeaderboard(eventId, trackId)
  → headers: { x-api-key: <api_key> }
  → parse entries, sort by fastestLapTime (or avgTime for "average" format)
  → write to State.leaderboard[]
  → sleep leaderboard_poll_interval seconds, repeat
```

### Race (WebSocket subscription)

```
race_task
  → connect wss://xxxxx.appsync-realtime-api.<region>.amazonaws.com/graphql
  → AppSync WebSocket protocol: header + payload base64-encoded in URL query params
  → subscribe: onNewOverlayInfo(eventId, trackId)
  → on message → parse raceStatus, timeLeftInMs, laps[], currentLapTimeInMs, username
  → write to State.race
  → on disconnect → exponential backoff reconnect (2s → 4s → 8s → cap 60s)
```

### Shared State object

```python
State.race = {
    "status": "RACE_IN_PROGRESS",   # or READY_TO_START / RACE_PAUSED / RACE_FINISHED
    "username": "DAVE",
    "time_left_ms": 154000,
    "laps": [...],                  # full laps array from subscription
    "resets": 2,                    # total resets across all laps
    "fastest_lap_ms": 12450,
    "last_lap_ms": 13210,
}
State.leaderboard = [
    { "username": "DAVE", "fastest_lap_ms": 12450, "position": 1 },
    ...
]
State.event_name = "DREM Cup 2026"
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| WiFi unavailable on boot | Retry up to 10× with 2s delay; display `CONNECTING...` in white |
| WiFi drops mid-session | Display `NO WIFI` in red; retry on 5s backoff; resume when reconnected |
| WebSocket disconnected | Silent reconnect with exponential backoff; display `RECONNECTING...` if no data for >10s |
| HTTP poll fails | Skip update; retain stale leaderboard; retry next interval |
| `config.json` missing/malformed | Display `CONFIG ERROR` in red; halt — fail loudly |
| Unexpected crash | Display exception on LEDs; hard-reset after 10s for self-recovery |

---

## AppSync GraphQL Queries

**Leaderboard query** (`getLeaderboard`):
```graphql
query GetLeaderboard($eventId: ID!, $trackId: ID!) {
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

Both use **API_KEY** authentication (`x-api-key` header for HTTP; base64-encoded in WebSocket URL params).

---

## Future Work

- **DREM config generator** — admin UI page that generates and downloads a pre-filled `config.json` for the Pico
- **`race_format` from event data** — derive fastest/average from AppSync event rather than config
- **Additional Unicorn variants** — Cosmic Unicorn (32×32) and Stellar Unicorn (16×16) support with alternative display layouts
- **OTA config** — Pico polls a known URL for config updates, enabling remote reconfiguration without USB access
