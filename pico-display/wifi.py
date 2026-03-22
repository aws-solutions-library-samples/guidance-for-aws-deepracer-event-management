# wifi.py — MicroPython only; requires network module
import utime

try:
    import network
    import uasyncio as asyncio
    _ON_PICO = True
except ImportError:
    _ON_PICO = False


async def connect(config, display):
    """Connect to WiFi on boot. Retries up to 10 times with 2s delay."""
    if not _ON_PICO:
        return
    ssid = config["wifi"]["ssid"]
    password = config["wifi"]["password"]
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    for attempt in range(10):
        display.show_status("CONNECTING...", (255, 255, 255))
        if wlan.isconnected():
            return
        await asyncio.sleep(2)
    # Exhausted retries — fail loudly
    display.show_status("NO WIFI", (255, 0, 0))
    raise OSError("WiFi connection failed after 10 attempts")


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
