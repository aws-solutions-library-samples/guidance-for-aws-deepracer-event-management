# display.py
# Top section: pure business logic (testable on CPython)
# Bottom section: hardware driver (Galactic Unicorn, only runs on Pico)

DIVIDER = "  ·  "


def format_ms(ms):
    """Format integer milliseconds as MM:SS (for time remaining)."""
    total_s = int(ms) // 1000
    m = total_s // 60
    s = total_s % 60
    return f"{m:02d}:{s:02d}"


def format_s(ms):
    """Format integer milliseconds as SS.sssS (for lap times)."""
    return f"{int(ms) / 1000:.3f}s"


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
        self._gu.update(self._pg)
        self._x_offset -= max(1, self._scroll_speed // self.SCROLL_RATE_HZ)

    def scroll_complete(self):
        """True when text has fully scrolled off the left edge."""
        text_width = len(self._text) * 6  # approximate 6px per char
        return self._x_offset < -text_width

    def flash(self, colour, duration_ms=500):
        """Synchronous flash — blocks for duration_ms (use only from display_task)."""
        import utime
        self._pg.set_pen(self._pg.create_pen(*colour))
        self._pg.clear()
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
        self._gu.update(self._pg)
