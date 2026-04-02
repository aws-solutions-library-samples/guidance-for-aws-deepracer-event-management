# ota.py — Over-the-air update for Pico display
# Downloads latest Python files from DREM website and writes to flash

# Files to update (never overwrite config.json — preserves local credentials)
OTA_FILES = [
    "main.py",
    "config.py",
    "display.py",
    "leaderboard.py",
    "race.py",
    "state.py",
    "wifi.py",
    "ota.py",
]


def build_ota_url(config):
    """Build the base URL for OTA downloads from config.

    Derives the DREM website URL from the AppSync endpoint:
      https://XXXX.appsync-api.eu-west-1.amazonaws.com/graphql
    becomes:
      https://<drem_url>/pico-display/

    If config has an explicit 'ota.base_url', use that instead.
    """
    ota_cfg = config.get("ota", {})
    base = ota_cfg.get("base_url")
    if base:
        return base.rstrip("/") + "/"
    return None


def ota_update(config, display):
    """Synchronous OTA update — downloads files and reboots.

    Called when button D is held during boot. Blocks until complete.
    Requires WiFi to be connected first.
    """
    import urequests
    import machine

    base_url = build_ota_url(config)
    if not base_url:
        display.show_status("NO OTA URL", (255, 0, 0))
        import utime
        utime.sleep(3)
        return

    display.show_status("UPDATING", (255, 220, 0))

    success = 0
    failed = 0
    for filename in OTA_FILES:
        url = base_url + filename
        try:
            display.show_status(filename, (0, 240, 255))
            resp = urequests.get(url)
            if resp.status_code == 200:
                with open(filename, "w") as f:
                    f.write(resp.text)
                resp.close()
                success += 1
                print(f"[ota] updated {filename}")
            else:
                resp.close()
                failed += 1
                print(f"[ota] {filename}: HTTP {resp.status_code}")
        except Exception as e:
            failed += 1
            print(f"[ota] {filename}: {e}")

    if failed == 0:
        display.show_status("DONE", (0, 255, 80))
    else:
        display.show_status(f"{failed} FAIL", (255, 0, 0))

    import utime
    utime.sleep(2)

    print(f"[ota] {success} updated, {failed} failed — rebooting")
    machine.reset()
