# race.py
# Top section: pure derivation logic (testable on CPython)
# Bottom section: WebSocket task (requires network, not unit tested)


def derive_race_state(overlay):
    """
    Derive structured race state from a raw onNewOverlayInfo payload dict.
    Returns a dict suitable for State.race.
    """
    laps = overlay.get("laps") or []
    resets = sum(lap.get("resets") or 0 for lap in laps)
    valid_times = [lap["time"] for lap in laps if lap.get("isValid") is True]
    fastest_lap_ms = int(round(min(valid_times))) if valid_times else None
    valid_laps = [lap for lap in laps if lap.get("isValid") is True]
    last_lap_ms = int(round(valid_laps[-1]["time"])) if valid_laps else None
    return {
        "status": overlay["raceStatus"],
        "username": overlay.get("username") or "",
        "time_left_ms": int(overlay.get("timeLeftInMs") or 0),
        "laps": laps,
        "resets": resets,
        "fastest_lap_ms": fastest_lap_ms,
        "last_lap_ms": last_lap_ms,
    }


# ---------------------------------------------------------------------------
# WebSocket subscription task — requires network; not unit tested
# ---------------------------------------------------------------------------
SUBSCRIPTION_QUERY = (
    "subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) {"
    " onNewOverlayInfo(eventId: $eventId, trackId: $trackId) {"
    " eventId eventName trackId username raceStatus"
    " timeLeftInMs currentLapTimeInMs"
    " laps { lapId time isValid resets }"
    " countryCode } }"
)

RACE_STATUSES = {"READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED", "RACE_FINISHED", "RACE_SUBMITTED"}


def _build_ws_url(config):
    """Build the AppSync real-time WebSocket URL with base64url-encoded header+payload."""
    try:
        import ubinascii
        b64 = lambda s: ubinascii.b2a_base64(s.encode()).decode().strip()
    except ImportError:
        import base64
        b64 = lambda s: base64.b64encode(s.encode()).decode()

    try:
        import ujson as json
    except ImportError:
        import json

    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    region = config["appsync"]["region"]
    # Derive host from HTTP endpoint
    host = endpoint.replace("https://", "").replace("/graphql", "")
    rt_host = host.replace("appsync-api", "appsync-realtime-api")
    header = b64(json.dumps({"host": host, "x-api-key": api_key}))
    payload = b64("{}")
    return f"wss://{rt_host}/graphql?header={header}&payload={payload}"


async def race_task(config, state, display):
    """
    Maintains a graphql-ws WebSocket to AppSync.
    Subscribes to onNewOverlayInfo and writes to state.race.
    On race-end statuses, signals display to flash.
    Uses exponential backoff on disconnect.
    """
    import uasyncio as asyncio
    try:
        import uwebsocket as ws_lib
    except ImportError:
        import websocket as ws_lib  # desktop fallback for manual testing

    try:
        import ujson as json
    except ImportError:
        import json

    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    url = _build_ws_url(config)
    backoff = 2

    while True:
        try:
            ws = ws_lib.connect(url, subprotocols=["graphql-ws"])
            # Connection handshake
            ws.send(json.dumps({"type": "connection_init"}))
            while True:
                msg = json.loads(ws.recv())
                if msg.get("type") == "connection_ack":
                    break

            # Subscribe
            ws.send(json.dumps({
                "id": "1",
                "type": "start",
                "payload": {
                    "query": SUBSCRIPTION_QUERY,
                    "variables": {"eventId": event_id, "trackId": track_id},
                },
            }))

            backoff = 2  # reset on successful connect
            last_data_ms = _now_ms()

            while True:
                await asyncio.sleep_ms(50)
                msg_raw = ws.recv()
                if not msg_raw:
                    if _now_ms() - last_data_ms > 10_000:
                        display.show_status("RECONNECTING...", (255, 120, 0))
                    continue
                msg = json.loads(msg_raw)
                if msg.get("type") == "ka":
                    continue  # keep-alive, ignore
                if msg.get("type") != "data":
                    continue
                last_data_ms = _now_ms()
                overlay = msg["payload"]["data"]["onNewOverlayInfo"]
                _handle_overlay(overlay, state, display)

        except Exception as e:
            print(f"race_task error: {e}")
            display.show_status("RECONNECTING...", (255, 120, 0))
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def _now_ms():
    try:
        import utime
        return utime.ticks_ms()
    except ImportError:
        import time
        return int(time.time() * 1000)


def _handle_overlay(overlay, state, display):
    """Dispatch on raceStatus and update state/display accordingly."""
    status = overlay.get("raceStatus", "")
    event_name = overlay.get("eventName") or ""
    if event_name:
        state.event_name = event_name

    if status == "NO_RACER_SELECTED":
        state.race = None
        return

    if status in ("READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED", "RACE_FINISHED"):
        state.race = derive_race_state(overlay)

    if status == "RACE_FINISHED":
        # display_task polls state.race["status"] and triggers the flash
        pass

    if status == "RACE_SUBMITTED":
        # Signal via sentinel; display_task handles the flash using stored fastest_lap_ms
        if state.race:
            state.race["status"] = "RACE_SUBMITTED"
