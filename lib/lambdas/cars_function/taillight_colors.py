"""Car tail-light colour palette + hex->PWM conversion (pure, no AWS deps)."""

# Full-scale per-channel PWM the DeepRacer firmware uses (verified: the named
# presets below use this value for a fully-on channel).
MAX_PWM = 9999825

# Convenience named presets (used by the /admin/devices colour dropdown).
PALETTE = {
    "blue": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 0},
    "red": {"blue_pwm": 0, "green_pwm": 0, "red_pwm": 9999825},
    "marigold": {"blue_pwm": 0, "green_pwm": 5097950, "red_pwm": 9999825},
    "orchid purple": {"blue_pwm": 5019520, "green_pwm": 0, "red_pwm": 5019520},
    "sky blue": {"blue_pwm": 9999825, "green_pwm": 5646960, "red_pwm": 1176450},
    "green": {"blue_pwm": 0, "green_pwm": 9882180, "red_pwm": 4862660},
    "violet": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 9999825},
    "lime": {"blue_pwm": 0, "green_pwm": 9999825, "red_pwm": 9999825},
}


def hex_to_pwm(hex_str):
    """Convert a #RRGGBB hex colour to a {red_pwm, green_pwm, blue_pwm} dict.

    Raises ValueError/IndexError for malformed input (caller falls back).
    """
    h = hex_str.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected 6 hex digits, got {hex_str!r}")
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)

    def scale(channel):
        return round(channel / 255 * MAX_PWM)

    return {"red_pwm": scale(r), "green_pwm": scale(g), "blue_pwm": scale(b)}


def color_for(selected):
    """Resolve a tail-light colour spec to PWM values.

    Accepts either a #RRGGBB hex string or a named preset (case-insensitive).
    Falls back to blue for anything unrecognised or malformed.
    """
    if selected and selected.startswith("#"):
        try:
            return hex_to_pwm(selected)
        except (ValueError, IndexError):
            return PALETTE["blue"]
    return PALETTE.get((selected or "").lower(), PALETTE["blue"])
