#!/usr/bin/env python3
"""
appsync_debug.py — subscribe to AppSync onNewOverlayInfo using the same
auth and graphql-ws framing as the Pico, and print every received message.

Usage:
    python3 appsync_debug.py [path/to/config.json]

Requires: websockets>=10  (pip install websockets)
"""

import asyncio
import base64
import json
import ssl
import sys
import time

try:
    import websockets
except ImportError:
    sys.exit("Install websockets first:  pip install websockets")


SUBSCRIPTION_QUERY = (
    "subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) {"
    " onNewOverlayInfo(eventId: $eventId, trackId: $trackId) {"
    " eventId eventName trackId username raceStatus"
    " timeLeftInMs currentLapTimeInMs"
    " laps { lapId time isValid resets }"
    " countryCode } }"
)


def _amz_date():
    t = time.gmtime()
    return "%04d%02d%02dT%02d%02d%02dZ" % (t[0], t[1], t[2], t[3], t[4], t[5])


def _b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def _build_ws_url(config):
    endpoint = config["appsync"]["endpoint"]
    api_key  = config["appsync"]["api_key"]
    host     = endpoint.replace("https://", "").replace("/graphql", "")
    rt_host  = host.replace("appsync-api", "appsync-realtime-api")
    amz_date = _amz_date()
    header_json = json.dumps({"host": host, "x-amz-date": amz_date, "x-api-key": api_key})
    auth_subprotocol = "header-" + _b64url(header_json)
    return f"wss://{rt_host}/graphql", auth_subprotocol


async def run(config):
    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    api_key  = config["appsync"]["api_key"]
    endpoint = config["appsync"]["endpoint"]
    host     = endpoint.replace("https://", "").replace("/graphql", "")

    url, auth_subprotocol = _build_ws_url(config)
    print(f"Connecting to {url}")

    ssl_ctx = ssl.create_default_context()
    async with websockets.connect(
        url,
        subprotocols=["graphql-ws", auth_subprotocol],
        ssl=ssl_ctx,
    ) as ws:
        print("WebSocket connected — sending connection_init")
        await ws.send(json.dumps({"type": "connection_init"}))

        # Wait for connection_ack
        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            print(f"  <- {msg.get('type')}")
            if msg.get("type") == "connection_ack":
                break
            if msg.get("type") == "connection_error":
                sys.exit(f"connection_error: {raw}")

        # Subscribe
        amz_date = _amz_date()
        sub = json.dumps({
            "id": "1",
            "type": "start",
            "payload": {
                "data": json.dumps({
                    "query": SUBSCRIPTION_QUERY,
                    "variables": {"eventId": event_id, "trackId": track_id},
                }),
                "extensions": {
                    "authorization": {
                        "x-api-key": api_key,
                        "host": host,
                        "x-amz-date": amz_date,
                    }
                },
            },
        })
        await ws.send(sub)
        print(f"Subscribed (eventId={event_id} trackId={track_id})")
        print("Waiting for events — set up a race in DREM now...\n")

        async for raw in ws:
            msg = json.loads(raw)
            msg_type = msg.get("type")
            if msg_type == "ka":
                print(f"  [ka]  {time.strftime('%H:%M:%S')}")
                continue
            if msg_type == "start_ack":
                print(f"  [start_ack]")
                continue
            if msg_type == "data":
                overlay = msg["payload"]["data"]["onNewOverlayInfo"]
                status  = overlay.get("raceStatus")
                laps    = len(overlay.get("laps") or [])
                t_left  = overlay.get("timeLeftInMs")
                user    = overlay.get("username")
                print(f"  [data]  {time.strftime('%H:%M:%S')}  status={status}  user={user}  laps={laps}  timeLeft={t_left}")
            else:
                print(f"  [{msg_type}]  {raw[:120]}")


def main():
    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.json"
    try:
        with open(config_path) as f:
            config = json.load(f)
    except FileNotFoundError:
        sys.exit(f"config.json not found at {config_path}")

    try:
        asyncio.run(run(config))
    except KeyboardInterrupt:
        print("\nDone.")


if __name__ == "__main__":
    main()
