# bootstrap.py — minimal first-boot loader
# Flash this as main.py + config.json to a fresh Pico.
# It connects to WiFi, downloads ota.py, runs OTA to fetch all files
# (including the full main.py), then reboots into the full app.

import uasyncio as asyncio


async def boot():
    try:
        import ujson as json
    except ImportError:
        import json

    # Load config
    try:
        with open("config.json") as f:
            cfg = json.load(f)
    except Exception as e:
        print(f"[bootstrap] config.json error: {e}")
        raise SystemExit(str(e))

    ota_cfg = cfg.get("ota", {})
    base_url = ota_cfg.get("base_url")
    if not base_url:
        print("[bootstrap] No ota.base_url in config.json")
        raise SystemExit("Missing ota.base_url")
    base_url = base_url.rstrip("/") + "/"

    # Minimal display
    try:
        from galactic import GalacticUnicorn
        from picographics import PicoGraphics, DISPLAY_GALACTIC_UNICORN
        gu = GalacticUnicorn()
        pg = PicoGraphics(display=DISPLAY_GALACTIC_UNICORN)
        gu.set_brightness(0.5)
        has_display = True
    except ImportError:
        has_display = False

    def show(text):
        if has_display:
            pg.set_pen(pg.create_pen(0, 0, 0))
            pg.clear()
            pg.set_font("bitmap6x8")
            pg.set_pen(pg.create_pen(255, 220, 0))
            x = max(0, (53 - len(text) * 7) // 2)
            pg.text(text, x, 1, scale=1)
            gu.update(pg)
        print(f"[bootstrap] {text}")

    # Connect WiFi
    show("SETUP")
    import network
    import utime
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    ssid = cfg["wifi"]["ssid"]
    wlan.connect(ssid, cfg["wifi"]["password"])
    show("WIFI...")
    while not wlan.isconnected():
        if wlan.status() < 0:
            wlan.disconnect()
            utime.sleep(1)
            wlan.connect(ssid, cfg["wifi"]["password"])
        await asyncio.sleep(2)
    wlan.config(pm=wlan.PM_NONE)
    print(f"[bootstrap] connected, ip={wlan.ifconfig()[0]}")

    # Download ota.py first
    show("GET OTA")
    import urequests
    try:
        resp = urequests.get(base_url + "ota.py")
        if resp.status_code == 200:
            with open("ota.py", "w") as f:
                f.write(resp.text)
            resp.close()
            print("[bootstrap] ota.py downloaded")
        else:
            resp.close()
            show("OTA FAIL")
            utime.sleep(3)
            raise SystemExit(f"Failed to download ota.py: HTTP {resp.status_code}")
    except Exception as e:
        show("OTA FAIL")
        utime.sleep(3)
        raise SystemExit(str(e))

    # Also download config.py (needed by ota.py's imports in full main.py)
    show("GET CFG")
    try:
        resp = urequests.get(base_url + "config.py")
        if resp.status_code == 200:
            with open("config.py", "w") as f:
                f.write(resp.text)
            resp.close()
            print("[bootstrap] config.py downloaded")
        else:
            resp.close()
    except Exception:
        pass  # non-fatal, OTA will retry

    # Run OTA to download everything else (including full main.py)
    show("UPDATING")
    from ota import ota_update

    class BootDisplay:
        def show_status(self, text, colour):
            show(text)

    ota_update(cfg, BootDisplay())
    # ota_update reboots; if we get here, it failed
    show("REBOOT")
    import machine
    machine.reset()


try:
    asyncio.run(boot())
except Exception as e:
    import sys
    try:
        with open("crash.log", "w") as f:
            f.write(str(type(e)) + ": " + str(e) + "\n")
            sys.print_exception(e, f)
    except Exception:
        pass
    print(f"[bootstrap] FATAL: {e}")
    import machine
    machine.reset()
