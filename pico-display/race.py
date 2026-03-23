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
# Custom WebSocket client — MicroPython's websocket.connect() does not support
# the subprotocols argument; AppSync requires Sec-WebSocket-Protocol: graphql-ws
# in the HTTP upgrade so we do the handshake manually.
# ---------------------------------------------------------------------------

class _AppSyncWS:
    """Minimal RFC 6455 text-frame WebSocket client (client→server frames masked)."""

    def __init__(self, ssl_sock, raw_sock):
        self._s = ssl_sock
        self._raw = raw_sock

    def close(self):
        for s in (self._s, self._raw):
            try:
                s.close()
            except Exception:
                pass

    def send(self, text):
        import struct
        data = text.encode()
        n = len(data)
        try:
            import urandom
            mask = bytes([urandom.getrandbits(8) for _ in range(4)])
        except Exception:
            import os
            mask = os.urandom(4)
        hdr = bytearray([0x81])  # FIN + text opcode
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126)
            hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127)
            hdr += struct.pack(">Q", n)
        hdr += mask
        payload = bytearray(data)
        for i in range(n):
            payload[i] ^= mask[i % 4]
        self._s.write(bytes(hdr) + bytes(payload))

    def ping(self):
        """Send a masked empty ping frame (RFC 6455 opcode 9)."""
        try:
            import urandom
            mask = bytes([urandom.getrandbits(8) for _ in range(4)])
        except Exception:
            import os
            mask = os.urandom(4)
        self._s.write(bytes([0x89, 0x80]) + mask)  # FIN+ping, MASK bit, 0-byte payload

    def _read_n(self, n):
        """Read exactly n bytes, retrying on -110 (no data yet) with a brief sleep.

        SSLSocket on Pimoroni firmware does not support settimeout(), so we
        use a busy-retry approach. Once we have committed to reading a frame
        (we already have the header byte) the payload is always in-flight and
        arrives within a few milliseconds; 200 × 10 ms = 2 s max wait.
        """
        import utime
        buf = bytearray()
        retries = 0
        while len(buf) < n:
            try:
                chunk = self._s.read(n - len(buf))
                if not chunk:
                    raise OSError("WS connection closed")
                buf += chunk
                retries = 0
            except OSError as e:
                if e.args[0] in (-110, 110, 116):
                    retries += 1
                    if retries > 200:
                        raise OSError("WS recv payload timeout")
                    utime.sleep_ms(10)
                else:
                    raise
        return bytes(buf)

    def recv(self):
        """Return next text frame payload, '_pong_' for pong, or None if no data."""
        import struct
        try:
            import uselect as _select
        except ImportError:
            import select as _select
        # Non-blocking check via select — avoids settimeout() which also affects writes.
        if not _select.select([self._raw], [], [], 0)[0]:
            return None
        first = self._s.read(1)
        if not first:
            raise OSError("WS connection closed")
        # Data is arriving — read the rest of the frame, retrying on -110.
        second = self._read_n(1)
        opcode = first[0] & 0x0F
        n = second[0] & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._read_n(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._read_n(8))[0]
        if opcode == 8:  # close
            raise OSError("WS closed by server")
        if opcode == 9:  # ping from server — reply with masked empty pong
            if n:
                self._read_n(n)
            self._s.write(b"\x8a\x80\x00\x00\x00\x00")
            return None
        if opcode == 10:  # pong — response to our ping
            if n:
                self._read_n(n)
            return "_pong_"
        payload = self._read_n(n) if n else b""
        if opcode in (0, 1):
            return payload.decode()
        return None


def _ws_connect(url, auth_subprotocol):
    """
    Open a TLS WebSocket to an AppSync real-time URL.
    Auth is passed as a second WebSocket subprotocol per Amplify v6:
      Sec-WebSocket-Protocol: graphql-ws, header-{base64url}
    Returns an _AppSyncWS ready for graphql-ws framing.
    """
    try:
        import usocket as socket
    except ImportError:
        import socket
    try:
        import ussl as ssl
    except ImportError:
        import ssl
    try:
        import ubinascii
        def _b64enc(b):
            return ubinascii.b2a_base64(b).decode().strip()
    except ImportError:
        import base64
        def _b64enc(b):
            return base64.b64encode(b).decode()

    # Parse wss://host/resource
    rest = url[6:]  # strip "wss://"
    slash = rest.find("/")
    host = rest[:slash]
    resource = rest[slash:]

    # Random 16-byte handshake key
    try:
        import urandom
        key_bytes = bytes([urandom.getrandbits(8) for _ in range(16)])
    except Exception:
        import os
        key_bytes = os.urandom(16)
    ws_key = _b64enc(key_bytes)

    # TCP + TLS — keep raw_sock reference so we can set timeout after handshake
    addr = socket.getaddrinfo(host, 443, 0, socket.SOCK_STREAM)[0][-1]
    raw_sock = socket.socket()
    raw_sock.connect(addr)
    ssl_sock = ssl.wrap_socket(raw_sock, server_hostname=host)

    # HTTP 101 upgrade — auth passed as second subprotocol (Amplify v6 approach)
    req = (
        "GET {} HTTP/1.1\r\n"
        "Host: {}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: {}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "Sec-WebSocket-Protocol: graphql-ws, {}\r\n"
        "\r\n"
    ).format(resource, host, ws_key, auth_subprotocol)
    ssl_sock.write(req.encode())

    # Read response headers (blocking — data arrives immediately)
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = ssl_sock.read(1)
        if not chunk:
            raise OSError("Connection closed during WS handshake")
        resp += chunk

    if b"101" not in resp:
        raise OSError("WS upgrade failed: " + resp[:80].decode("utf-8", "replace"))

    # Leave socket in blocking mode — writes must not timeout.
    # recv() uses uselect.select() for non-blocking reads instead.
    return _AppSyncWS(ssl_sock, raw_sock)


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


def _amz_date():
    """Return current UTC time as x-amz-date string: YYYYMMDDTHHMMSSZ."""
    try:
        import utime
        t = utime.gmtime()
    except ImportError:
        import time
        t = time.gmtime()
    return "%04d%02d%02dT%02d%02d%02dZ" % (t[0], t[1], t[2], t[3], t[4], t[5])


def _build_ws_url(config):
    """
    Build the AppSync real-time WebSocket URL and auth subprotocol string.
    Amplify v6 passes auth as a second Sec-WebSocket-Protocol value, not URL params:
      Sec-WebSocket-Protocol: graphql-ws, header-{base64url({"host","x-amz-date","x-api-key"})}
    Returns (url, auth_subprotocol).
    """
    try:
        import ubinascii
        def b64(s):
            return ubinascii.b2a_base64(s.encode()).decode().strip().replace('+', '-').replace('/', '_').rstrip('=')
    except ImportError:
        import base64
        def b64(s):
            return base64.urlsafe_b64encode(s.encode()).decode().rstrip('=')

    endpoint = config["appsync"]["endpoint"]
    api_key = config["appsync"]["api_key"]
    host = endpoint.replace("https://", "").replace("/graphql", "")
    rt_host = host.replace("appsync-api", "appsync-realtime-api")
    amz_date = _amz_date()
    # Build auth header JSON matching Amplify v6 API key format
    header_json = '{"host":"' + host + '","x-amz-date":"' + amz_date + '","x-api-key":"' + api_key + '"}'
    auth_subprotocol = "header-" + b64(header_json)
    return "wss://" + rt_host + "/graphql", auth_subprotocol


async def race_task(config, state, display):
    """
    Maintains a graphql-ws WebSocket to AppSync.
    Subscribes to onNewOverlayInfo and writes to state.race.
    On race-end statuses, signals display to flash.
    Uses exponential backoff on disconnect.
    """
    import uasyncio as asyncio
    try:
        import ujson as json
    except ImportError:
        import json

    dbg = config.get("debug", False)
    event_id = config["event"]["event_id"]
    track_id = config["event"]["track_id"]
    api_key = config["appsync"]["api_key"]
    endpoint = config["appsync"]["endpoint"]
    host = endpoint.replace("https://", "").replace("/graphql", "")
    backoff = 2
    attempt = 0
    ws = None

    while True:
        attempt += 1
        ws = None
        try:
            # Rebuild URL+subprotocol each attempt so x-amz-date is fresh
            url, auth_subprotocol = _build_ws_url(config)
            if dbg:
                print(f"[race] {_ts()} attempt {attempt}: connecting to {url[:40]}...")
            display.set_status_pixel((255, 120, 0))  # orange while connecting
            ws = _ws_connect(url, auth_subprotocol)
            if dbg:
                print("[race] WS upgrade OK, sending connection_init")
            # Auth is carried in the Sec-WebSocket-Protocol subprotocol; payload is empty
            ws.send('{"type":"connection_init"}')
            ack_deadline = _now_ms() + 60_000
            while True:
                await asyncio.sleep_ms(50)
                if _now_ms() > ack_deadline:
                    raise OSError("AppSync connection_ack timeout (60s)")
                msg_raw = ws.recv()
                if not msg_raw:
                    continue
                msg_type = json.loads(msg_raw).get("type")
                if dbg:
                    print(f"[race] {_ts()} ack-wait got: {msg_type}")
                if msg_type == "connection_ack":
                    break
                if msg_type == "connection_error":
                    raise OSError("AppSync connection_error — check API key/endpoint in config.json")

            if dbg:
                print("[race] connection_ack received, subscribing")
            # Subscribe — AppSync format: data as JSON string + extensions.authorization
            amz_date = _amz_date()
            ws.send(json.dumps({
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
            }))

            display.set_status_pixel((0, 200, 0))  # green — connected to AppSync
            backoff = 2  # reset on successful connect
            last_data_ms = _now_ms()
            _last_stale_report = 0  # seconds, for throttling debug prints
            _last_ping_ms = _now_ms()
            if dbg:
                print(f"[race] subscribed (eventId={event_id} trackId={track_id})")

            while True:
                await asyncio.sleep_ms(50)

                # Client-side WebSocket ping every 5s to keep the CYW43 TCP connection alive.
                # CYW43 has a ~15s idle timer; pinging at 5s keeps well within that.
                # Dead connections are detected by OSError on the write itself.
                now_ms = _now_ms()
                if now_ms - _last_ping_ms > 5_000:
                    ws.ping()
                    _last_ping_ms = now_ms
                    if dbg:
                        print("[race] ping sent")

                msg_raw = ws.recv()
                if not msg_raw:
                    stale_ms = _now_ms() - last_data_ms
                    if stale_ms > 120_000:
                        raise OSError("no AppSync data for 2 minutes — reconnecting")
                    if stale_ms > 90_000:
                        display.set_status_pixel((255, 120, 0))  # orange — no data for 90s (ka fires every 60s)
                        if dbg:
                            stale_s = stale_ms // 1000
                            if stale_s - _last_stale_report >= 60:
                                print("[race] no data for " + str(stale_s) + "s")
                                _last_stale_report = stale_s
                    continue

                if msg_raw == "_pong_":
                    last_data_ms = _now_ms()
                    if dbg:
                        print("[race] pong ok")
                    continue

                msg = json.loads(msg_raw)
                msg_type = msg.get("type")
                if msg_type == "ka":
                    last_data_ms = _now_ms()  # keep-alive counts as live connection
                    if dbg:
                        print(f"[race] {_ts()} ka")
                    continue
                if msg_type == "start_ack":
                    state.ws_connected = True  # signal leaderboard_task it's safe to fetch
                if dbg:
                    print(f"[race] {_ts()} msg: {msg_type}")
                if msg_type != "data":
                    continue
                last_data_ms = _now_ms()
                overlay = msg["payload"]["data"]["onNewOverlayInfo"]
                status = overlay.get("raceStatus")
                print(f"[race] {_ts()} raceStatus={status}")
                if dbg:
                    print(f"[race] overlay keys: {list(overlay.keys())}")
                    print(f"[race] laps={len(overlay.get('laps') or [])}")
                    print(f"[race] timeLeft={overlay.get('timeLeftInMs')}")
                _handle_overlay(overlay, state, display)
                if dbg:
                    print(f"[race] state.race={state.race}")

        except Exception as e:
            import sys as _sys
            print(f"[race] {_ts()} error (attempt {attempt}): {e}")
            _sys.print_exception(e)
            state.ws_connected = False
            if ws is not None:
                ws.close()
                ws = None
            display.set_status_pixel((255, 0, 0))  # red — disconnected
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def _now_ms():
    try:
        import utime
        return utime.ticks_ms()
    except ImportError:
        import time
        return int(time.time() * 1000)


def _ts():
    """Return current UTC time as HH:MM:SS for debug prints."""
    try:
        import utime
        t = utime.gmtime()
    except ImportError:
        import time
        t = time.gmtime()
    return "%02d:%02d:%02d" % (t[3], t[4], t[5])


def _handle_overlay(overlay, state, display):
    """Dispatch on raceStatus and update state/display accordingly."""
    status = overlay.get("raceStatus", "")
    event_name = overlay.get("eventName") or ""
    if event_name:
        state.event_name = event_name

    if status == "NO_RACER_SELECTED":
        state.race = None
        return

    if status in ("READY_TO_START", "RACE_IN_PROGRESS", "RACE_PAUSED"):
        state.race = derive_race_state(overlay)
        state.race["time_left_received_ms"] = _now_ms()

    if status in ("RACE_FINISHED", "RACE_FINSIHED"):  # RACE_FINSIHED: backend typo, kept for safety
        # This event arrives with laps=0 — preserve existing lap data (fastest_lap_ms etc.)
        # so display_task can flash the best time; just update the status.
        if state.race:
            state.race["status"] = "RACE_FINISHED"
        else:
            state.race = derive_race_state(overlay)
            state.race["status"] = "RACE_FINISHED"
        state.refresh_leaderboard = True

    if status == "RACE_SUBMITTED":
        # Signal via sentinel; display_task handles the flash using stored fastest_lap_ms
        if state.race:
            state.race["status"] = "RACE_SUBMITTED"
        state.refresh_leaderboard = True
