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
    Polls AppSync getLeaderboard every leaderboard_poll_interval seconds.
    Writes to state.leaderboard and state.leaderboard_title.
    """
    import uasyncio as asyncio
    try:
        import urequests as requests
    except ImportError:
        import requests

    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    race_format = config["event"]["race_format"]
    poll_interval = config["display"].get("leaderboard_poll_interval", 30)
    top_n = config["display"].get("leaderboard_top_n", 5)
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}

    while True:
        try:
            import ujson as json
        except ImportError:
            import json
        payload = json.dumps({
            "query": LEADERBOARD_QUERY,
            "variables": {"eventId": event_id, "trackId": track_id},
        })
        try:
            resp = requests.post(endpoint, headers=headers, data=payload)
            data = resp.json()
            resp.close()
            title, entries = parse_leaderboard(data, race_format, top_n)
            if title:
                state.leaderboard_title = title
            state.leaderboard = entries
        except Exception as e:
            print(f"leaderboard_task error: {e}")
            # retain stale leaderboard; retry next interval

        await asyncio.sleep(poll_interval)
