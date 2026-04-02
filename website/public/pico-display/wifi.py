# wifi.py — MicroPython only; requires network module
import utime

try:
    import network
    import uasyncio as asyncio
    _ON_PICO = True
except ImportError:
    _ON_PICO = False


async def connect(config, display):
    """Connect to WiFi on boot. Retries forever with 2s delay."""
    if not _ON_PICO:
        return
    dbg = config.get("debug", False)
    ssid = config["wifi"]["ssid"]
    password = config["wifi"]["password"]
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    attempt = 0
    while True:
        attempt += 1
        status = wlan.status()
        if dbg:
            print(f"[wifi] attempt {attempt} status={status} ssid={ssid!r}")
        display.show_status("CONNECTING...", (255, 255, 255))
        if wlan.isconnected():
            wlan.config(pm=wlan.PM_NONE)  # disable power management — prevents CYW43 sleep causing write timeouts
            ip = wlan.ifconfig()[0]
            print(f"[wifi] connected, ip={ip}")
            try:
                import ntptime
                ntptime.settime()  # sync RTC to UTC — required for x-amz-date in AppSync auth
                if dbg:
                    print("[wifi] NTP sync ok")
            except Exception as e:
                print(f"[wifi] NTP sync failed: {e}")  # non-fatal
            return
        await asyncio.sleep(2)


async def watch(display):
    """Background task: monitors WiFi and shows NO WIFI when disconnected."""
    if not _ON_PICO:
        return
    import network as net
    import uasyncio as asyncio
    wlan = net.WLAN(net.STA_IF)
    while True:
        await asyncio.sleep(5)
        if not wlan.isconnected():
            display.show_status("NO WIFI", (255, 0, 0))
