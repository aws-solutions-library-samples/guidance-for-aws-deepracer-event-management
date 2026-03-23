# main.py — entry point; runs on Pico W
import uasyncio as asyncio


async def boot():
    from config import load_config, ConfigError
    from state import State
    from display import Display, display_task
    from wifi import connect as wifi_connect, watch as wifi_watch
    from leaderboard import leaderboard_task
    from race import race_task

    cfg = None
    # Minimal display needed before config loads
    try:
        disp = Display(brightness=0.5)
    except ImportError:
        raise SystemExit("Not running on Galactic Unicorn firmware")

    try:
        cfg = load_config()
    except Exception as e:
        disp.show_status("CONFIG ERROR", (255, 0, 0))
        raise SystemExit(str(e))

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
