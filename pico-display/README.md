# Pico W Galactic Unicorn MicroPython Display App

A MicroPython application for Raspberry Pi Pico W with Pimoroni Galactic Unicorn LED matrix display. Shows live race data and leaderboard from DREM (AWS DeepRacer Event Manager).

## Hardware Requirements

- **Raspberry Pi Pico W** — wireless-enabled microcontroller
- **Pimoroni Galactic Unicorn** — 53×11 RGB LED matrix display module

Install the Pimoroni MicroPython firmware from [pimoroni/unicorn](https://github.com/pimoroni/unicorn). Follow the flashing instructions in the repository.

## Getting the Configuration

1. Navigate to the **DREM admin portal** → **Device Management** → **Pico LED Display**
2. Fill in the form: event, track, race format, WiFi network name and password, and display settings
3. Click **"Download config.json"** — the file is ready to use as-is, no further editing needed

If you don't have the admin portal available, use `config.json.example` as a template:

```bash
cp pico-display/config.json.example pico-display/config.json
```

Then edit it with your WiFi credentials, AppSync endpoint, API key, and event details.

## Installation

### Option 1: Quick Start — 2 files (Recommended)

Only two files are needed for initial setup. The bootstrap downloads everything else over WiFi:

1. Generate a `config.json` from the DREM admin page (Device Management → Pico LED Display) or copy from `config.json.example`
2. Connect the Pico W via USB and copy both files using mpremote:

```bash
mpremote cp pico-display/bootstrap.py :main.py
mpremote cp pico-display/config.json :config.json
```

3. Power cycle the Pico — it will automatically connect to WiFi, download all code files, and reboot into the full app

Alternatively, use [Thonny](https://thonny.org/) — upload `bootstrap.py` as `main.py` and `config.json` to the Pico root.

### Option 2: Full Manual Install

If you prefer to upload all files manually:

1. Upload all `.py` files and `config.json` to the root of the Pico using Thonny or rshell:
   - `main.py`, `config.py`, `wifi.py`, `race.py`, `leaderboard.py`, `display.py`, `state.py`, `ota.py`, `config.json`

### Option 3: Over-the-Air (OTA) Update

Once the app is running (via either option above), you can update all Python files over WiFi:

1. Hold **button D** during power-up
2. The display shows **OTA MODE**, connects to WiFi, then downloads each file
3. After all files are written, the Pico reboots with the new code

The OTA source files are served from your DREM website at `/pico-display/`. See the [OTA configuration](#ota-section) below.

**Note:** `config.json` is never overwritten by OTA — your local WiFi credentials and event settings are preserved.

## Hardware Buttons

The Galactic Unicorn has four hardware buttons (A, B, C, D). **Hold a button during power-up** to activate that mode:

| Button | Mode | Display shows |
|--------|------|---------------|
| **A** | Single-line race display | `1-LINE` then boots normally |
| **B** | Dual-line race display | `2-LINE` then boots normally |
| **C** | Reserved | — |
| **D** | OTA update | `OTA MODE` → downloads latest code → reboots |

If no button is held, the display uses the `race_display_lines` value from `config.json`.

## Display Behaviour

The display runs a state machine driven by the live `raceStatus` field from AppSync:

| State | Display | Notes |
|-------|---------|-------|
| Idle (no race) | Alternates between event name and scrolling leaderboard every 10 s | |
| `READY_TO_START` | **READY?** in yellow | |
| `RACE_IN_PROGRESS` | Countdown timer (MM:SS) in white, counting down smoothly between AppSync updates | Green double-flash on each completed lap; yellow double-flash on each reset |
| `RACE_PAUSED` | **PAUSED** in red | |
| `RACE_FINISHED` / `RACE_SUBMITTED` | Chequered flag animation (3.2 s), then results scroll (name · laps · best lap · position) × 2, then returns to leaderboard idle | |

The top-left pixel shows connection health: **green** = connected, **orange** = no data for >90 s, **red** = reconnecting.

## Troubleshooting

The display shows status messages during startup and operation. Common messages and solutions:

| Message | Meaning | Solution |
|---------|---------|----------|
| `CONFIG ERROR` | `config.json` is missing, malformed JSON, or has missing required fields | Check that `config.json` exists and is valid JSON. Use `config.json.example` as a template. |
| `NO WIFI` | Cannot connect to WiFi network | Verify SSID and password in `config.json`. Check WiFi signal strength. |
| `RECONNECTING...` | Lost connection to DREM AppSync API | Normal operation; app will reconnect automatically. Check internet connection. |

To debug further, connect to the Pico's serial console via Thonny (View → Serial) to see detailed logs. Enable `"debug": true` in `config.json` for verbose output.

### WiFi status codes

When debug mode is enabled the WiFi connection log includes a numeric `status=` code on each attempt:

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Idle / not started | Normal during initial setup |
| `1` | Connecting | Normal — waiting for association |
| `2` | Wrong password | Check `wifi.password` in `config.json` |
| `3` | No AP found | SSID not visible — check name and signal |
| `-3` | Connection failed | Try power-cycling the Pico and the access point |
| `1010` | Connected | Success |

## Configuration Reference

### `display` section

```json
"display": {
  "brightness": 0.5,        // LED brightness (0.0–1.0)
  "scroll_speed": 40,       // Leaderboard scroll speed in pixels/second
  "leaderboard_top_n": 5    // Number of leaderboard entries to show
}
```

### `event` section

```json
"event": {
  "event_id": "paste-event-id-from-drem-here",
  "track_id": "1",
  "race_format": "fastest"   // "fastest" or "average"
}
```

### `appsync` section

```json
"appsync": {
  "endpoint": "https://XXXXXXXXXXXX.appsync-api.eu-west-1.amazonaws.com/graphql",
  "api_key": "da2-XXXXXXXXXXXXXXXXXXXXXXXXXX",
  "region": "eu-west-1"
}
```

### `ota` section

```json
"ota": {
  "base_url": "https://your-drem-cloudfront-url.com/pico-display/"
}
```

The base URL points to your DREM website's CloudFront distribution. The OTA updater downloads each Python file from `{base_url}{filename}`. Only `.py` files are updated — `config.json` is never touched.

**For developers:** after modifying pico-display Python files, run `make pico.sync` to copy them to `website/public/pico-display/` ready for deployment. Run `make pico.test` to run the test suite.

### `debug` flag

```json
"debug": true
```

Enables verbose serial output: connection attempts, ping/pong, race status changes, overlay keys and lap data on every event.

## AppSync WebSocket Protocol

The app connects to the AppSync real-time endpoint using the `graphql-ws` subprotocol over a TLS WebSocket. Authentication follows the Amplify v6 pattern: the API key is passed as a second `Sec-WebSocket-Protocol` subprotocol header encoded as `header-<base64url({"host","x-amz-date","x-api-key"})>`.

### Connection flow

```
Pico → AppSync   connection_init
AppSync → Pico   connection_ack
Pico → AppSync   subscribe (onNewOverlayInfo, filtered by eventId + trackId)
AppSync → Pico   start_ack
AppSync → Pico   data  (race state messages, see below)
AppSync → Pico   ka    (keep-alive, every ~60 seconds)
```

After `start_ack`, AppSync immediately pushes the current overlay state and then sends updates as the race progresses.

The Pico sends a WebSocket ping (RFC 6455 opcode 9) every 5 seconds to keep the CYW43 TCP connection alive (see implementation notes below). AppSync responds with a pong frame.

### Race state messages

Each `data` message contains an `onNewOverlayInfo` payload with a `raceStatus` field. The states arrive in this order during a normal race:

| `raceStatus` | `laps` | `timeLeft` | Meaning |
|---|---|---|---|
| `NO_RACER_SELECTED` | 0 | null | No active racer — display returns to idle |
| `READY_TO_START` | 0 | full duration | Race staged and ready; fires every 5 s |
| `RACE_IN_PROGRESS` | incrementing | counting down | Race running; fires every 2 s |
| `RACE_PAUSED` | as-is | as-is | Race paused or stopped by operator |
| `RACE_FINISHED` | **0** | null | Race ended — see note below |
| `RACE_SUBMITTED` | final count | 0 | Results submitted to leaderboard |
| `NO_RACER_SELECTED` | 0 | null | Returns to idle |

**Note — `RACE_FINISHED` arrives with `laps=0`:** this event is a sentinel that signals the race has ended; it does not carry the lap summary. The app preserves the lap data accumulated during `RACE_IN_PROGRESS` and only updates the status field, so the end-of-race results scroll shows the correct best time.

**Note — `RACE_PAUSED` precedes `RACE_FINISHED`:** the operator ends a race by pressing Stop, which sends `RACE_PAUSED` followed ~5 s later by `RACE_FINISHED`. This is normal; the app does not flash on pause so the PAUSED state does not look like a motorsport red flag before the chequered flag.

**Known backend typo:** the backend sends `RACE_FINSIHED` (missing the second `I`) instead of `RACE_FINISHED`. The app handles both spellings.

### Keep-alive behaviour

AppSync sends a `ka` (keep-alive) frame every ~60 seconds when no race data is being sent. The status pixel on the display reflects connection health:

| Pixel colour | Meaning |
|---|---|
| Green | Connected and receiving data or keep-alives |
| Orange | No data received for >90 s (one missed keep-alive interval) |
| Red / off | Reconnecting |

## CYW43 Implementation Notes

These are hard-won findings from getting a reliable long-running WebSocket connection on the Pico W. Documented here to save future debugging time.

### TCP idle timer (~15 s)

The CYW43 WiFi chip's internal TCP stack closes connections after approximately **15 seconds of no outbound application data**. This is not configurable at the application level. Observed empirically: the first outbound write after an idle period fails immediately with `OSError(-110)` (ETIMEDOUT) regardless of the socket's configured timeout.

**Fix:** send a WebSocket ping frame every 5 seconds — well within the 15 s idle threshold. This keeps the CYW43 TCP state machine alive without measurable overhead.

### CYW43 power management

By default the CYW43 runs in `PM_POWERSAVE` mode, sleeping between WiFi beacon intervals (~100 ms). When the chip is sleeping, outbound writes must wait for the chip to wake. With a short socket send timeout (e.g. `settimeout(0.1)` = 100 ms), writes can fail with ETIMEDOUT if the wake-up takes longer than the timeout.

**Fix:** call `wlan.config(pm=wlan.PM_NONE)` immediately after connecting. This keeps the radio always awake and writes complete in <1 ms. The power cost is acceptable for an event display device that runs connected to USB.

### `settimeout()` applies to both reads and writes

`raw_sock.settimeout(t)` on a MicroPython socket sets the timeout for all I/O operations — reads and writes. Using it to achieve non-blocking reads (common pattern: `settimeout(0.1)`) also caps write latency, which interacts badly with power management (see above).

**Fix:** leave the socket in blocking mode for writes. Use `uselect.select([raw_sock], [], [], 0)` for non-blocking read polling instead. This gives instant non-blocking reads without affecting write behaviour.

### Two simultaneous TLS sessions exhaust RAM

The Pico W has ~200 KB usable RAM. An active TLS WebSocket session uses ~80–100 KB of the CYW43 SSL buffer. Opening a second TLS connection (e.g. the leaderboard HTTPS fetch) while the WebSocket TLS session is active causes `ECONNABORTED` on one or both sessions.

**Fix:** `leaderboard_task` waits for `state.ws_connected` to become `True` (set by `race_task` after receiving `start_ack`) and then waits a further 10 seconds for the initial WebSocket traffic to settle before opening the leaderboard HTTPS connection.

### `_read_n()` retry pattern for fragmented TLS records

AppSync messages of 400–550 bytes span multiple TLS records. After the first byte of a WebSocket frame header arrives, subsequent `read()` calls for the payload may return `OSError(-110)` if the remaining TLS record bytes have not yet been buffered by the CYW43. A retry loop with `utime.sleep_ms(10)` and up to 200 retries (2 s maximum) reliably reassembles fragmented frames.
