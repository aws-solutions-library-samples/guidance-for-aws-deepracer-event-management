# leaderboard.py
# Top section: pure parse/sort logic (testable on CPython)
# Bottom section: HTTP polling task (requires network, not unit tested)


def parse_leaderboard(data, race_format, top_n):
    """
    Parse a raw getLeaderboard GraphQL response.
    Returns (leaderboard_title, entries[:top_n]) where entries have:
      position, username, fastest_lap_ms
    and are sorted by the given race_format.
    """
    board = data["data"]["getLeaderboard"]
    title = board["config"].get("leaderBoardTitle", "")
    raw_entries = board.get("entries") or []

    parsed = []
    for e in raw_entries:
        ft = e.get("fastestLapTime")
        at = e.get("avgLapTime")
        parsed.append({
            "username": e.get("username", ""),
            "fastest_lap_ms": int(round(ft)) if ft is not None else None,
            "_avg_ms": int(round(at)) if at is not None else None,
        })

    _INF = float("inf")
    if race_format == "fastest":
        parsed.sort(key=lambda x: x["fastest_lap_ms"] if x["fastest_lap_ms"] is not None else _INF)
    else:  # "average"
        parsed.sort(key=lambda x: x["_avg_ms"] if x["_avg_ms"] is not None else _INF)

    # Assign position from full sorted board, then slice
    for i, entry in enumerate(parsed):
        entry["position"] = i + 1
        del entry["_avg_ms"]  # not needed in State

    return title, parsed[:top_n]


# ---------------------------------------------------------------------------
# HTTP polling task — requires network; not unit tested
# ---------------------------------------------------------------------------
LEADERBOARD_QUERY = """
query GetLeaderboard($eventId: ID!, $trackId: ID) {
  getLeaderboard(eventId: $eventId, trackId: $trackId) {
    config { leaderBoardTitle }
    entries {
      username fastestLapTime avgLapTime numberOfValidLaps countryCode
    }
  }
}
"""


async def leaderboard_task(config, state):
    """
    Fetches the leaderboard on startup, then again at +5s and +10s after each race
    finishes (signalled via state.refresh_leaderboard). No periodic polling.
    """
    import uasyncio as asyncio
    import gc
    try:
        import ujson as json
    except ImportError:
        import json
    try:
        import urequests as requests
    except ImportError:
        import requests

    dbg = config.get("debug", False)
    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    race_format = config["event"]["race_format"]
    top_n = config["display"].get("leaderboard_top_n", 5)
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}
    payload = json.dumps({
        "query": LEADERBOARD_QUERY,
        "variables": {"eventId": event_id, "trackId": track_id},
    })

    async def fetch():
        gc.collect()
        resp = None
        if dbg:
            print("[lb] fetching leaderboard")
        try:
            resp = requests.post(endpoint, headers=headers, data=payload)
            data = resp.json()
            title, entries = parse_leaderboard(data, race_format, top_n)
            if title:
                state.leaderboard_title = title
            state.leaderboard = entries
            if dbg:
                print("[lb] ok: title=" + repr(title) + " entries=" + str(len(entries)))
        except Exception as e:
            print("[lb] error: " + str(e))
        finally:
            if resp is not None:
                resp.close()

    # Wait for the WebSocket to be established before the first fetch.
    # Two simultaneous TLS sessions exhaust Pico W RAM; race_task sets this flag
    # after receiving start_ack so we know the WebSocket TLS handshake is complete.
    while not state.ws_connected:
        await asyncio.sleep(1)
    await asyncio.sleep(10)  # let initial WebSocket traffic settle before opening a second TLS session
    await fetch()

    # Event-driven: poll at +5s and +10s after each race finishes.
    while True:
        await asyncio.sleep(1)
        if state.refresh_leaderboard:
            state.refresh_leaderboard = False
            await asyncio.sleep(5)
            await fetch()
            await asyncio.sleep(5)
            await fetch()
