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
