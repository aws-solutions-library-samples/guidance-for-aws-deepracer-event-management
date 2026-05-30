from taillight_colors import hex_to_pwm, color_for, PALETTE, MAX_PWM


def test_hex_to_pwm_full_and_zero_channels():
    assert hex_to_pwm("#FF0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}
    assert hex_to_pwm("#00FF00") == {"red_pwm": 0, "green_pwm": MAX_PWM, "blue_pwm": 0}
    assert hex_to_pwm("#0000FF") == {"red_pwm": 0, "green_pwm": 0, "blue_pwm": MAX_PWM}
    assert hex_to_pwm("#FFFFFF") == {"red_pwm": MAX_PWM, "green_pwm": MAX_PWM, "blue_pwm": MAX_PWM}
    assert hex_to_pwm("#000000") == {"red_pwm": 0, "green_pwm": 0, "blue_pwm": 0}


def test_hex_to_pwm_accepts_lowercase_and_no_hash():
    assert hex_to_pwm("ff0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}


def test_color_for_routes_hex_and_named():
    assert color_for("#FF0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}
    assert color_for("blue") == PALETTE["blue"]
    assert color_for("BLUE") == PALETTE["blue"]


def test_color_for_falls_back_to_blue_on_bad_input():
    assert color_for("#ZZZZZZ") == PALETTE["blue"]
    assert color_for("nonsense") == PALETTE["blue"]
    assert color_for("") == PALETTE["blue"]
    assert color_for(None) == PALETTE["blue"]
    assert color_for("ff0000") == PALETTE["blue"]  # no '#' → treated as a name, falls back


def test_palette_hexes_map_to_backend_dict_pwm():
    """The 8 frontend palette hexes must reproduce the backend PALETTE dict PWM.

    Mirror of website/src/constants/tailLightColours.ts (the 8 presets) and the
    PALETTE dict in taillight_colors.py (used directly by index.py).
    If the frontend palette or backend dict drift, this fails.

    All 8 values match exactly (round(channel/255 * 9999825) — no rounding delta
    observed for any of the 8 preset hexes).
    """
    expected = {
        "#0000FF": {"red_pwm": 0,        "green_pwm": 0,        "blue_pwm": 9999825},  # blue
        "#FF0000": {"red_pwm": 9999825,  "green_pwm": 0,        "blue_pwm": 0},        # red
        "#FF8200": {"red_pwm": 9999825,  "green_pwm": 5097950,  "blue_pwm": 0},        # marigold
        "#800080": {"red_pwm": 5019520,  "green_pwm": 0,        "blue_pwm": 5019520},  # orchid purple
        "#1E90FF": {"red_pwm": 1176450,  "green_pwm": 5646960,  "blue_pwm": 9999825},  # sky blue
        "#7CFC00": {"red_pwm": 4862660,  "green_pwm": 9882180,  "blue_pwm": 0},        # green
        "#FF00FF": {"red_pwm": 9999825,  "green_pwm": 0,        "blue_pwm": 9999825},  # violet/magenta
        "#FFFF00": {"red_pwm": 9999825,  "green_pwm": 9999825,  "blue_pwm": 0},        # lime/yellow
    }
    for hex_value, dict_pwm in expected.items():
        pwm = hex_to_pwm(hex_value)
        assert pwm["red_pwm"]   == dict_pwm["red_pwm"],   hex_value
        assert pwm["green_pwm"] == dict_pwm["green_pwm"], hex_value
        assert pwm["blue_pwm"]  == dict_pwm["blue_pwm"],  hex_value
