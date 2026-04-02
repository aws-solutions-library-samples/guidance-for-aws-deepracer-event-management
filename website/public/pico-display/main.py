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
    from state import State
    from display import Display, display_task, COLOUR_GREEN, COLOUR_CYAN, COLOUR_YELLOW
    from wifi import connect as wifi_connect, watch as wifi_watch
    from leaderboard import leaderboard_task
    from race import race_task

    cfg = None
    # Minimal display needed before config loads
    try:
        disp = Display(brightness=0.5)
    except ImportError:
        raise SystemExit("Not running on Galactic Unicorn firmware")

    # Check for boot button press
    boot_button = check_boot_buttons(disp._gu)

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
    elif boot_button == 'D':
        # OTA update mode — connect WiFi then download latest code
        disp.show_status("OTA MODE", COLOUR_YELLOW)
        import utime
        utime.sleep(1)
        await wifi_connect(cfg, disp)
        from ota import ota_update
        ota_update(cfg, disp)
        # ota_update reboots on completion; if we get here, it failed
        return

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
