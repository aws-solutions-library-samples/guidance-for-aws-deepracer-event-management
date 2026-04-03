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
        parts.append(f"#{entry['position']} {entry['username']}: {t_str}")
    return DIVIDER.join(parts)


def build_race_2line_bottom(race):
    """Bottom row for 2-line race display: racer name · best lap · last lap."""
    parts = []
    name = race.get("username")
    if name:
        parts.append(name)
    best = race.get("fastest_lap_ms")
    if best is not None:
        parts.append("best " + format_s(best))
    last = race.get("last_lap_ms")
    if last is not None:
        parts.append("last " + format_s(last))
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

    # x positions for 2-line top row (bitmap4x5 font, ~5px per char)
    # "MM:SS" (5 chars = 25px) · laps · resets
    _2LINE_TIME_X   = 0
    _2LINE_LAPS_X   = 27
    _2LINE_RST_X    = 40

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
        # 2-line race mode: scrolling bottom row
        self._bottom_text = ""
        self._bottom_x = 0
        self._bottom_colour = COLOUR_WHITE

    def set_status_pixel(self, colour):
        """Set the bottom-right status pixel: green=ok, orange=warn, red=error."""
        self._status_colour = colour

    def _draw_status_pixel(self):
        r, g, b = self._status_colour
        self._pg.set_pen(self._pg.create_pen(r // 4, g // 4, b // 4))
        self._pg.pixel(52, 10)  # bottom-right, dimmed to 25%

    def set_text(self, text, colour=COLOUR_WHITE):
        self._text = text
        self._colour = colour
        self._x_offset = self.WIDTH  # start scrolling from the right

    def set_bottom_text(self, text, colour=COLOUR_WHITE):
        """Set the scrolling bottom row text for 2-line race mode."""
        self._bottom_text = text
        self._bottom_x = self.WIDTH
        self._bottom_colour = colour

    def tick(self):
        """Called every frame; advances scroll by scroll_speed/SCROLL_RATE_HZ pixels."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_font("bitmap6x8")
        self._pg.set_pen(self._pg.create_pen(*self._colour))
        self._pg.text(self._text, self._x_offset, 1, scale=1)
        self._draw_status_pixel()
        self._gu.update(self._pg)
        self._x_offset -= max(1, self._scroll_speed // self.SCROLL_RATE_HZ)

    def tick_2line(self, time_str, laps_str, resets_str, time_colour=None):
        """One frame of 2-line race display.
        Top row (bitmap4x5): time (colour) · laps (cyan) · resets (orange).
        Separator: dim line at y=5.
        Bottom row (bitmap4x5): scrolling racer info.
        """
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_font("bitmap4x5")

        # Top row — three coloured elements at fixed x positions
        self._pg.set_pen(self._pg.create_pen(*(time_colour or COLOUR_YELLOW)))
        self._pg.text(time_str, self._2LINE_TIME_X, 0, scale=1)
        self._pg.set_pen(self._pg.create_pen(*COLOUR_CYAN))
        self._pg.text(laps_str, self._2LINE_LAPS_X, 0, scale=1)
        self._pg.set_pen(self._pg.create_pen(*COLOUR_ORANGE))
        self._pg.text(resets_str, self._2LINE_RST_X, 0, scale=1)

        # Bottom row — scrolling racer info (natural 1px gap at y=5)
        self._pg.set_pen(self._pg.create_pen(*self._bottom_colour))
        self._pg.text(self._bottom_text, self._bottom_x, 6, scale=1)

        self._draw_status_pixel()
        self._gu.update(self._pg)
        self._pg.set_font("bitmap5x7")  # restore default

        self._bottom_x -= max(1, self._scroll_speed // self.SCROLL_RATE_HZ)

    def scroll_complete(self):
        """True when text has fully scrolled off the left edge."""
        text_width = len(self._text) * 7  # bitmap6x8 at scale=1: ~7px per char
        return self._x_offset < -text_width

    def bottom_scroll_complete(self):
        """True when bottom row text has fully scrolled off the left edge."""
        text_width = len(self._bottom_text) * 5  # ~5px per char for bitmap4x5
        return self._bottom_x < -text_width

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
        """Show a static short status string centred on the display (bitmap6x8)."""
        self._pg.set_pen(self._pg.create_pen(0, 0, 0))
        self._pg.clear()
        self._pg.set_font("bitmap6x8")
        self._pg.set_pen(self._pg.create_pen(*colour))
        x = max(0, (self.WIDTH - len(text) * 7) // 2)
        self._pg.text(text, x, 1, scale=1)
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
    display_cfg = config.get("display", {})
    race_display_lines = display_cfg.get("race_display_lines", 1)
    lap_time_display_ms = int(display_cfg.get("lap_time_display_s", 3) * 1000)
    frame_ms = 1000 // Display.SCROLL_RATE_HZ
    idle_mode = "branding"   # "branding" | "leaderboard"
    idle_timer = 0
    _cur_text = ""
    _branding_index = 0
    # Build branding texts from config — event name + up to 2 custom lines
    _branding_texts = []
    _branding_texts.append(display_cfg.get("branding_1", ""))
    _branding_texts.append(display_cfg.get("branding_2", ""))
    # Filter out empty strings
    _branding_texts = [t for t in _branding_texts if t]
    if not _branding_texts:
        _branding_texts = ["DREM"]
    _cur_bottom_text = ""
    _prev_status = None
    _prev_laps = 0
    _prev_resets = 0
    _lap_display_until_ms = 0

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

            # First transition into RACE_IN_PROGRESS — show "GO GO GO"
            if _prev_status != "RACE_IN_PROGRESS":
                if dbg:
                    print("[disp] GO GO GO")
                display.show_status("GO GO GO", COLOUR_GREEN)
                await asyncio.sleep_ms(2000)

            if _prev_status == "RACE_IN_PROGRESS":
                # Resets checked first — flash yellow before green so the
                # sequence reads "something went wrong" → "lap recorded"
                # (AppSync often batches a reset + lap into one event)
                if resets > _prev_resets:
                    if dbg:
                        print(f"[disp] reset {resets} - yellow flash")
                    for _ in range(2):
                        display.flash(COLOUR_YELLOW, 250)
                        await asyncio.sleep_ms(100)
                if laps > _prev_laps:
                    if dbg:
                        print(f"[disp] lap {laps} - green flash")
                    for _ in range(2):
                        display.flash(COLOUR_GREEN, 250)
                        await asyncio.sleep_ms(100)
                    _lap_display_until_ms = _utime.ticks_ms() + lap_time_display_ms

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

            # Timer at zero — show chequered flag until race status changes
            if effective_time == 0:
                _flag_phase = getattr(display, '_flag_phase', 0)
                display.chequered_flag_frame(_flag_phase % 2)
                display._flag_phase = _flag_phase + 1
                await asyncio.sleep_ms(400)
                continue

            if effective_time <= 10_000:
                timer_colour = COLOUR_RED
            elif effective_time <= 20_000:
                timer_colour = COLOUR_YELLOW
            else:
                timer_colour = COLOUR_WHITE

            if race_display_lines == 2:
                bottom = build_race_2line_bottom(race)
                if bottom != _cur_bottom_text or display.bottom_scroll_complete():
                    display.set_bottom_text(bottom, COLOUR_WHITE)
                    _cur_bottom_text = bottom
                display.tick_2line(format_ms(effective_time), str(laps), str(resets), timer_colour)
            else:
                try:
                    show_lap = _utime.ticks_diff(_lap_display_until_ms, _utime.ticks_ms()) > 0
                except AttributeError:
                    show_lap = int(_utime.time() * 1000) < _lap_display_until_ms
                if show_lap and race.get("last_lap_ms") is not None:
                    display.show_status(format_s(race["last_lap_ms"]), COLOUR_GREEN)
                else:
                    display.show_status(format_ms(effective_time), timer_colour)
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
            _lap_display_until_ms = 0
            _cur_bottom_text = ""
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
            if idle_mode == "branding":
                _branding_index += 1
                if _branding_index >= len(_branding_texts):
                    idle_mode = "leaderboard"
                    _branding_index = 0
            else:
                idle_mode = "branding"
            idle_timer = 0
            _cur_text = ""
            if dbg:
                print(f"[disp] idle mode -> {idle_mode} branding_index={_branding_index}")

        if idle_mode == "branding":
            text = _branding_texts[_branding_index % len(_branding_texts)]
            display.show_status(text, COLOUR_YELLOW)
        else:
            if state.leaderboard:
                text = build_leaderboard_string(state.leaderboard)
                if text != _cur_text or display.scroll_complete():
                    display.set_text(text, COLOUR_CYAN)
                    _cur_text = text
                display.tick()
            else:
                name = state.event_name or state.leaderboard_title or "DREM"
                display.show_status(name, COLOUR_YELLOW)
