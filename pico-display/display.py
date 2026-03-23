# display.py
# Top section: pure business logic (testable on CPython)
# Bottom section: hardware driver (Galactic Unicorn, only runs on Pico)

DIVIDER = "  ·  "


def _pad(n, width):
    s = str(n)
    return "0" * (width - len(s)) + s


def format_ms(ms):
    """Format integer milliseconds as MM:SS (for time remaining)."""
    total_s = int(ms) // 1000
    m = total_s // 60
    s = total_s % 60
    return _pad(m, 2) + ":" + _pad(s, 2)


def format_s(ms):
    """Format integer milliseconds as S.sss (for lap times)."""
    total = int(ms)
    return str(total // 1000) + "." + _pad(total % 1000, 3)


def build_race_string(race, race_items):
    """
    Build the scrolling race text from State.race and config race_items list.
    Items with None values are silently omitted.
    """
    valid_count = sum(1 for lap in race.get("laps", []) if lap.get("isValid") is True)
    parts = []
    for item in race_items:
        if item == "time_remaining":
            t = race.get("time_left_ms")
            if t is not None:
                parts.append(format_ms(t))
        elif item == "laps_completed":
            parts.append(f"{valid_count} laps")
        elif item == "fastest_lap":
            t = race.get("fastest_lap_ms")
            if t is not None:
                parts.append(f"best {format_s(t)}")
        elif item == "last_lap":
            t = race.get("last_lap_ms")
            if t is not None:
                parts.append(f"last {format_s(t)}")
        elif item == "resets":
            parts.append(f"{race.get('resets', 0)} resets")
    return DIVIDER.join(parts)


def build_leaderboard_string(leaderboard):
    """Build the scrolling idle leaderboard ticker text."""
    parts = []
    for entry in leaderboard:
        t = entry.get("fastest_lap_ms")
        t_str = format_s(t) if t is not None else "---"
        parts.append(f"#{entry['position']} {entry['username']} {t_str}")
    return DIVIDER.join(parts)


# ---------------------------------------------------------------------------
# Hardware driver — only importable on Pimoroni Galactic Unicorn firmware
# ---------------------------------------------------------------------------
# Colours (R, G, B)
COLOUR_YELLOW  = (255, 220, 0)
COLOUR_CYAN    = (0, 240, 255)
COLOUR_GREEN   = (0, 255, 80)
COLOUR_WHITE   = (255, 255, 255)
COLOUR_ORANGE  = (255, 120, 0)
COLOUR_RED     = (255, 0, 0)

ITEM_COLOURS = {
    "time_remaining": COLOUR_YELLOW,
    "laps_completed": COLOUR_CYAN,
    "fastest_lap":    COLOUR_GREEN,
    "last_lap":       COLOUR_WHITE,
    "resets":         COLOUR_ORANGE,
}


class Display:
    """
    Hardware driver wrapping GalacticUnicorn.
    Not unit-tested — requires Pimoroni firmware.
    """

    WIDTH = 53
    HEIGHT = 11
    SCROLL_RATE_HZ = 60         # ticks per second for the scroll loop

    def __init__(self, brightness=0.5, scroll_speed=40):
        from galactic import GalacticUnicorn
        from picographics import PicoGraphics, DISPLAY_GALACTIC_UNICORN
        self._gu = GalacticUnicorn()
        self._pg = PicoGraphics(display=DISPLAY_GALACTIC_UNICORN)
        self._gu.set_brightness(brightness)
        self._scroll_speed = scroll_speed   # pixels per second
        self._x_offset = 0
        self._text = ""
        self._colour = COLOUR_WHITE
        self._status_colour = COLOUR_RED    # red until WebSocket connects

    def set_status_pixel(self, colour):
        """Set the top-left corner status pixel: green=ok, orange=warn, red=error."""
        self._status_colour = colour

    def _draw_status_pixel(self):
        self._pg.set_pen(self._pg.create_pen(*self._status_colour))
        self._pg.pixel(0, 0)

    def set_text(self, text, colour=COLOUR_WHITE):
        self._text = text
        self._colour = colour
        self._x_offset = self.WIDTH  # start scrolling from the right

    def tick(self):
        """Called every frame; advances scroll by scroll_speed/SCROLL_RATE_HZ pixels."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_pen(self._pg.create_pen(*self._colour))
        self._pg.text(self._text, self._x_offset, 2, scale=1)
        self._draw_status_pixel()
        self._gu.update(self._pg)
        self._x_offset -= max(1, self._scroll_speed // self.SCROLL_RATE_HZ)

    def scroll_complete(self):
        """True when text has fully scrolled off the left edge."""
        text_width = len(self._text) * 6  # approximate 6px per char
        return self._x_offset < -text_width

    def flash(self, colour, duration_ms=500):
        """Synchronous full-screen flash — blocks for duration_ms."""
        import utime
        self._pg.set_pen(self._pg.create_pen(*colour))
        self._pg.clear()
        self._draw_status_pixel()
        self._gu.update(self._pg)
        utime.sleep_ms(duration_ms)
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._gu.update(self._pg)

    def show_status(self, text, colour=COLOUR_WHITE):
        """Show a static short status string centred on the display."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_pen(self._pg.create_pen(*colour))
        x = max(0, (self.WIDTH - len(text) * 6) // 2)
        self._pg.text(text, x, 2, scale=1)
        self._draw_status_pixel()
        self._gu.update(self._pg)

    def chequered_flag_frame(self, phase):
        """Render one frame of a 3×3-block chequered flag. phase=0 or 1 alternates."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        white = self._pg.create_pen(255, 255, 255)
        black = self._pg.create_pen(0, 0, 0)
        for row in range(self.HEIGHT):
            for col in range(self.WIDTH):
                if (col // 3 + row // 3 + phase) % 2 == 0:
                    self._pg.set_pen(white)
                    self._pg.pixel(col, row)
        self._draw_status_pixel()
        self._gu.update(self._pg)


# Idle cycle interval in seconds
IDLE_CYCLE_S = 10
# Chequered flag duration in frames (8 × 400 ms ≈ 3.2 s)
FLAG_FRAMES = 8


async def display_task(display, state, config):
    """
    Main display loop. Drives state machine:
      idle → READY_TO_START → RACE_IN_PROGRESS → RACE_PAUSED → RACE_FINISHED → idle
    """
    try:
        import uasyncio as asyncio
    except ImportError:
        import asyncio
    try:
        import utime as _utime
    except ImportError:
        import time as _utime

    dbg = config.get("debug", False)
    frame_ms = 1000 // Display.SCROLL_RATE_HZ
    idle_mode = "branding"   # "branding" | "leaderboard"
    idle_timer = 0
    _cur_text = ""
    _prev_status = None
    _prev_laps = 0
    _prev_resets = 0

    while True:
        await asyncio.sleep_ms(frame_ms)
        idle_timer += frame_ms

        race = state.race
        status = race.get("status") if race else None

        # ── READY TO START ────────────────────────────────────────────────────
        if status == "READY_TO_START":
            if status != _prev_status:
                if dbg:
                    print("[disp] READY_TO_START")
                _prev_status = status
                _prev_laps = 0
                _prev_resets = 0
            display.show_status("READY?", COLOUR_YELLOW)
            continue

        # ── RACE IN PROGRESS ──────────────────────────────────────────────────
        if status == "RACE_IN_PROGRESS":
            laps = len([l for l in (race.get("laps") or []) if l.get("isValid")])
            resets = race.get("resets", 0)

            if _prev_status == "RACE_IN_PROGRESS":
                if laps > _prev_laps:
                    if dbg:
                        print(f"[disp] lap {laps} - green flash")
                    for _ in range(2):
                        display.flash(COLOUR_GREEN, 250)
                        await asyncio.sleep_ms(100)
                if resets > _prev_resets:
                    if dbg:
                        print(f"[disp] reset {resets} - yellow flash")
                    for _ in range(2):
                        display.flash(COLOUR_YELLOW, 250)
                        await asyncio.sleep_ms(100)

            _prev_laps = laps
            _prev_resets = resets
            _prev_status = status
            # Interpolate time remaining between 2s AppSync events for smooth countdown
            received_at = race.get("time_left_received_ms")
            if received_at is not None:
                try:
                    elapsed = _utime.ticks_diff(_utime.ticks_ms(), received_at)
                except AttributeError:
                    elapsed = int(_utime.time() * 1000) - received_at
                effective_time = max(0, (race.get("time_left_ms") or 0) - elapsed)
            else:
                effective_time = race.get("time_left_ms") or 0
            display.show_status(format_ms(effective_time), COLOUR_WHITE)
            continue

        # ── RACE PAUSED ───────────────────────────────────────────────────────
        if status == "RACE_PAUSED":
            if status != _prev_status:
                if dbg:
                    print("[disp] RACE_PAUSED")
            _prev_status = status
            display.show_status("PAUSED", COLOUR_RED)
            continue

        # ── RACE FINISHED / SUBMITTED ─────────────────────────────────────────
        if status in ("RACE_FINISHED", "RACE_FINSIHED", "RACE_SUBMITTED"):
            if dbg:
                print(f"[disp] race ended — chequered flag")

            # Chequered flag animation
            for i in range(FLAG_FRAMES):
                display.chequered_flag_frame(i % 2)
                await asyncio.sleep_ms(400)

            # Build results scroll: name · N laps · best X.XXXs · P1
            username = race.get("username", "")
            valid_laps = len([l for l in (race.get("laps") or []) if l.get("isValid")])
            best = race.get("fastest_lap_ms")
            position = None
            for entry in state.leaderboard:
                if entry.get("username") == username:
                    position = entry.get("position")
                    break

            parts = []
            if username:
                parts.append(username)
            parts.append(str(valid_laps) + " laps")
            if best is not None:
                parts.append("best " + format_s(best))
            if position is not None:
                parts.append("P" + str(position))
            results = DIVIDER.join(parts)

            # Scroll results twice then return to leaderboard
            for _ in range(2):
                display.set_text(results, COLOUR_GREEN)
                while not display.scroll_complete():
                    await asyncio.sleep_ms(frame_ms)
                    display.tick()

            state.race = None
            _prev_status = None
            _prev_laps = 0
            _prev_resets = 0
            idle_mode = "leaderboard"
            idle_timer = 0
            _cur_text = ""
            continue

        # ── IDLE ──────────────────────────────────────────────────────────────
        if _prev_status is not None:
            if dbg:
                print("[disp] -> idle")
            _prev_status = None
            _prev_laps = 0
            _prev_resets = 0

        if idle_timer >= IDLE_CYCLE_S * 1000:
            idle_mode = "leaderboard" if idle_mode == "branding" else "branding"
            idle_timer = 0
            _cur_text = ""
            if dbg:
                print(f"[disp] idle mode -> {idle_mode}")

        if idle_mode == "branding":
            name = state.event_name or state.leaderboard_title or "DREM"
            display.show_status(name, COLOUR_WHITE)
        else:
            if state.leaderboard:
                text = build_leaderboard_string(state.leaderboard)
                if text != _cur_text or display.scroll_complete():
                    display.set_text(text, COLOUR_WHITE)
                    _cur_text = text
                display.tick()
            else:
                name = state.event_name or state.leaderboard_title or "DREM"
                display.show_status(name, COLOUR_WHITE)
