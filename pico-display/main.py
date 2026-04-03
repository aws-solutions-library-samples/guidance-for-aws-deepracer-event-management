# main.py — entry point; runs on Pico W
import uasyncio as asyncio


def check_boot_buttons(gu):
    """Check which hardware button is held during boot.

    Returns: 'A', 'B', 'C', 'D', or None if no button pressed.
    """
    if gu.is_pressed(gu.SWITCH_A):
        return 'A'
    if gu.is_pressed(gu.SWITCH_B):
        return 'B'
    if gu.is_pressed(gu.SWITCH_C):
        return 'C'
    if gu.is_pressed(gu.SWITCH_D):
        return 'D'
    return None


async def boot():
    from config import load_config, ConfigError

    # Check for OTA mode BEFORE importing heavy modules like display.py
    # so those files aren't locked when we try to overwrite them
    try:
        from galactic import GalacticUnicorn
        gu = GalacticUnicorn()
    except ImportError:
        raise SystemExit("Not running on Galactic Unicorn firmware")

    boot_button = check_boot_buttons(gu)

    if boot_button == 'D':
        # OTA mode — use minimal display, don't import display.py
        from picographics import PicoGraphics, DISPLAY_GALACTIC_UNICORN
        pg = PicoGraphics(display=DISPLAY_GALACTIC_UNICORN)
        gu.set_brightness(0.5)

        def ota_status(text, r, g, b):
            pg.set_pen(pg.create_pen(0, 0, 0))
            pg.clear()
            pg.set_font("bitmap6x8")
            pg.set_pen(pg.create_pen(r, g, b))
            x = max(0, (53 - len(text) * 7) // 2)
            pg.text(text, x, 1, scale=1)
            gu.update(pg)

        ota_status("OTA MODE", 255, 220, 0)
        import utime
        utime.sleep(1)

        try:
            cfg = load_config()
        except Exception as e:
            ota_status("CONFIG ERR", 255, 0, 0)
            raise SystemExit(str(e))

        # Minimal WiFi connect for OTA (inline, no display.py dependency)
        import network
        ssid = cfg["wifi"]["ssid"]
        password = cfg["wifi"]["password"]
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        wlan.connect(ssid, password)
        ota_status("CONNECTING", 255, 255, 255)
        while not wlan.isconnected():
            status = wlan.status()
            if status < 0:
                wlan.disconnect()
                utime.sleep(1)
                wlan.connect(ssid, password)
            await asyncio.sleep(2)
        wlan.config(pm=wlan.PM_NONE)
        print(f"[ota] wifi connected, ip={wlan.ifconfig()[0]}")

        from ota import ota_update, OTA_FILES

        # Use ota_status as the display for OTA (duck-typed show_status)
        class OtaDisplay:
            def show_status(self, text, colour):
                ota_status(text, *colour)

        ota_update(cfg, OtaDisplay())
        # ota_update reboots; if we get here, it failed
        return

    # Normal boot — now safe to import heavy modules
    from state import State
    from display import Display, display_task, COLOUR_GREEN, COLOUR_CYAN, COLOUR_YELLOW
    from wifi import connect as wifi_connect, watch as wifi_watch
    from leaderboard import leaderboard_task
    from race import race_task

    cfg = None
    disp = Display(brightness=0.5)

    try:
        cfg = load_config()
    except Exception as e:
        disp.show_status("CONFIG ERROR", (255, 0, 0))
        raise SystemExit(str(e))

    # Apply boot button overrides
    if boot_button == 'A':
        cfg.setdefault("display", {})["race_display_lines"] = 1
        disp.show_status("1-LINE", COLOUR_GREEN)
        import utime
        utime.sleep(1)
    elif boot_button == 'B':
        cfg.setdefault("display", {})["race_display_lines"] = 2
        disp.show_status("2-LINE", COLOUR_CYAN)
        import utime
        utime.sleep(1)

    disp_configured = Display(
        brightness=cfg["display"].get("brightness", 0.5),
        scroll_speed=cfg["display"].get("scroll_speed", 40),
    )

    await wifi_connect(cfg, disp_configured)

    state = State()

    try:
        await asyncio.gather(
            display_task(disp_configured, state, cfg),
            leaderboard_task(cfg, state),
            race_task(cfg, state, disp_configured),
            wifi_watch(disp_configured),
        )
    except Exception as e:
        import sys
        try:
            with open("crash.log", "w") as f:
                f.write("gather: " + str(type(e)) + ": " + str(e) + "\n")
                sys.print_exception(e, f)
        except Exception:
            pass
        raise


try:
    asyncio.run(boot())
except Exception as e:
    # Last-resort crash handler: log exception to file then reboot
    import sys
    try:
        with open("crash.log", "w") as f:
            f.write(str(type(e)) + ": " + str(e) + "\n")
            sys.print_exception(e, f)
    except Exception:
        pass
    import machine
    machine.reset()
