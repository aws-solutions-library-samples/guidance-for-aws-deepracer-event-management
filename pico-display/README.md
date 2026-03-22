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

### Option 1: Using Thonny (Recommended)

1. Download and install [Thonny](https://thonny.org/)
2. Connect the Pico W to your computer via USB
3. Open Thonny and select the Pico W as the interpreter
4. Upload all `.py` files and `config.json` to the root of the Pico:
   - `main.py`
   - `config.py`
   - `wifi.py`
   - `race.py`
   - `leaderboard.py`
   - `display.py`
   - `state.py`
   - `config.json`

### Option 2: Using rshell

```bash
rshell cp pico-display/*.py /pyboard/
rshell cp pico-display/config.json /pyboard/
```

After uploading, the app will start automatically on the next power-on.

## Troubleshooting

The display shows status messages during startup and operation. Common messages and solutions:

| Message | Meaning | Solution |
|---------|---------|----------|
| `CONFIG ERROR` | `config.json` is missing, malformed JSON, or has missing required fields | Check that `config.json` exists and is valid JSON. Use `config.json.example` as a template. |
| `NO WIFI` | Cannot connect to WiFi network | Verify SSID and password in `config.json`. Check WiFi signal strength. |
| `RECONNECTING...` | Lost connection to DREM AppSync API | Normal operation; app will reconnect automatically. Check internet connection. |

To debug further, connect to the Pico's serial console via Thonny (View → Serial) to see detailed logs.

## Display Configuration Reference

Edit the `display` section of `config.json` to customize behavior:

```json
"display": {
  "brightness": 0.5,                    // LED brightness (0.0–1.0)
  "scroll_speed": 40,                   // Scroll delay in milliseconds
  "leaderboard_poll_interval": 30,      // Query leaderboard every N seconds
  "leaderboard_top_n": 5,               // Show top N racers on leaderboard
  "race_items": [                       // Items to show during active race
    "time_remaining",
    "laps_completed",
    "fastest_lap",
    "last_lap",
    "resets"
  ]
}
```

## Race Items Reference

Valid values for the `race_items` list. Each item is displayed on a separate screen that scrolls in sequence:

| Value | Display | Color |
|-------|---------|-------|
| `time_remaining` | Countdown timer (MM:SS) | Yellow |
| `laps_completed` | Number of valid laps completed | Cyan |
| `fastest_lap` | Best valid lap time (MM:SS.mmm) | Green |
| `last_lap` | Most recent valid lap time (MM:SS.mmm) | White |
| `resets` | Total reset count | Orange |

Example custom configuration (show only key metrics):

```json
"race_items": [
  "time_remaining",
  "laps_completed",
  "fastest_lap"
]
```

## Event Configuration Reference

The `event` section specifies which event and track to monitor:

```json
"event": {
  "event_id": "paste-event-id-from-drem-here",  // DREM event identifier
  "track_id": "1",                                // Track number
  "race_format": "fastest"                        // Race format (e.g., "fastest", "time_trial")
}
```

## AppSync Configuration

The `appsync` section contains credentials for accessing DREM:

```json
"appsync": {
  "endpoint": "https://XXXXXXXXXXXX.appsync-api.eu-west-1.amazonaws.com/graphql",  // AppSync endpoint
  "api_key": "da2-XXXXXXXXXXXXXXXXXXXXXXXXXX",                                      // API key
  "region": "eu-west-1"                                                             // AWS region
}
```

Obtain these values from the DREM admin portal or your infrastructure administrator.
