const http = require('http');

const proxy = require('http-proxy');
const ws = require('ws');

const config = {
  dremUrl: 'dremURL',
  port: 8080,
  gpio: {
    sensor1: 17, // GPIO17 (pin 11)
    sensor2: 27, // GPIO27 (pin 13)
    debounceMs: 2000, // Configurable debounce time per sensor
  },
};

console.log('Starting timer...');
console.log('Configuration:', JSON.stringify(config, null, 2));

const sockets = new Set();
let debugLapCounter = 0;

// Per-sensor debounce tracking
const sensorDebounce = {
  [config.gpio.sensor1]: { lastTrigger: 0, count: 0 },
  [config.gpio.sensor2]: { lastTrigger: 0, count: 0 },
};

// Try to detect which GPIO library to use
let gpioLib = null;
let gpioChipNumber = 0;
let useModernGpio = false;
let gpioLines = []; // stored for graceful cleanup
let gpioChip = null; // kept at module scope to prevent GC of the underlying C pointer
let gpioPollingInterval = null; // stored so it can be cleared before line release

// Try node-libgpiod first (libgpiod kernel interface — works on all RPi models with kernel 6.x+)
// kernel 6.x moved the legacy sysfs GPIO base to 512, which breaks rpi-gpio on all models.
// node-libgpiod uses /dev/gpiochipN (character device) and is unaffected by sysfs renumbering.
// Install: sudo apt install libgpiod-dev && npm install node-libgpiod
try {
  const libgpiod = require('node-libgpiod');
  gpioLib = libgpiod;
  useModernGpio = true;

  // Detect chip number only when node-libgpiod is available:
  // RPi 5 exposes the 40-pin header on gpiochip4; all earlier RPis use gpiochip0.
  try {
    const fs = require('fs');
    const model = fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '');
    if (model.includes('Raspberry Pi 5') || model.includes('Compute Module 5')) {
      gpioChipNumber = 4;
    }
    console.log(`Detected model: ${model.trim()}, using gpiochip${gpioChipNumber}`);
  } catch (e) {
    console.log('Could not read device model, defaulting to gpiochip0');
  }

  console.log('Using node-libgpiod (modern GPIO library - requires kernel > 6.x)');
} catch (e) {
  // Fall back to rpi-gpio for older Raspberry Pi models
  try {
    const rpiGpio = require('rpi-gpio');
    gpioLib = rpiGpio;
    useModernGpio = false;
    console.log('Using rpi-gpio (legacy GPIO library - requires kernel < 6.x)');
  } catch (e2) {
    console.error('ERROR: No GPIO library available. Install either node-libgpiod or rpi-gpio.');
    process.exit(1);
  }
}

// Get timestamp as milliseconds since Unix epoch (Date.now()).
// This allows the browser to compute network latency by comparing
// the received timestamp against its own Date.now() on arrival.
function getTimestamp() {
  return Date.now();
}

// Handle lap trigger
function handleLapTrigger(gpioPin, value, timestamp) {
  const now = timestamp || getTimestamp();
  const sensor = sensorDebounce[gpioPin];

  if (!sensor) {
    console.warn(`Unknown GPIO pin: ${gpioPin}`);
    return;
  }

  // Check debounce - ignore triggers within debounce window
  if (now - sensor.lastTrigger < config.gpio.debounceMs) {
    console.log(`Debounced: GPIO${gpioPin} (${now - sensor.lastTrigger}ms since last trigger)`);
    return;
  }

  sensor.lastTrigger = now;
  sensor.count++;
  debugLapCounter++;

  const lapData = JSON.stringify({
    event: 'lap',
    timestamp: now,
    gpio: gpioPin,
    lapNumber: debugLapCounter,
    sensorLapCount: sensor.count,
  });

  console.log(`${debugLapCounter}: Lap triggered - GPIO${gpioPin} at ${now} (${new Date(now).toISOString()})`);

  // Broadcast to all connected WebSocket clients
  let successCount = 0;
  let failCount = 0;

  for (const sock of sockets) {
    try {
      if (sock.readyState === ws.OPEN) {
        sock.send(lapData);
        successCount++;
      }
    } catch (e) {
      failCount++;
      console.error('Error sending to WebSocket:', e.message);
    }
  }

  if (failCount > 0) {
    console.warn(`Broadcast complete: ${successCount} successful, ${failCount} failed`);
  }
}

// Initialize GPIO based on available library
function initializeGpio() {
  if (useModernGpio) {
    // node-libgpiod does not expose eventWait/eventRead — polling getValue() is
    // the only supported approach. requestInputMode sets the line as an input;
    // the setInterval below detects rising edges by comparing successive reads.
    try {
      gpioChip = new gpioLib.Chip(gpioChipNumber);

      if (gpioChip === null) {
        console.error('Failed to initialize node-libgpiod: gpioChip is null');
        process.exit(1);
      }

      const line1 = gpioChip.getLine(config.gpio.sensor1);
      const line2 = gpioChip.getLine(config.gpio.sensor2);

      line1.requestInputMode('drem-timer');
      line2.requestInputMode('drem-timer');

      gpioLines = [line1, line2]; // stored for release() on graceful shutdown

      console.log(
        `GPIO initialized via gpiochip${gpioChipNumber}: sensor1=GPIO${config.gpio.sensor1}, sensor2=GPIO${config.gpio.sensor2}`
      );

      let lastState1 = line1.getValue();
      let lastState2 = line2.getValue();

      gpioPollingInterval = setInterval(() => {
        try {
          const state1 = line1.getValue();
          const state2 = line2.getValue();

          if (state1 === 1 && lastState1 === 0) {
            handleLapTrigger(config.gpio.sensor1, 1, getTimestamp());
          }
          if (state2 === 1 && lastState2 === 0) {
            handleLapTrigger(config.gpio.sensor2, 1, getTimestamp());
          }

          lastState1 = state1;
          lastState2 = state2;
        } catch (e) {
          console.error('Error polling GPIO:', e.message);
        }
      }, 10); // Poll every 10ms
    } catch (e) {
      console.error('Failed to initialize node-libgpiod:', e);
      process.exit(1);
    }
  } else {
    // Legacy rpi-gpio for older RPi models — use BCM (GPIO) numbering to match config
    gpioLib.setMode(gpioLib.MODE_BCM);

    gpioLib.on('change', function (channel, value) {
      const timestamp = getTimestamp();
      // channel is the BCM GPIO number, matching config.gpio.sensor1/2 directly
      if ((channel === config.gpio.sensor1 || channel === config.gpio.sensor2) && value) {
        handleLapTrigger(channel, value, timestamp);
      }
    });

    gpioLib.setup(config.gpio.sensor1, gpioLib.DIR_IN, gpioLib.EDGE_BOTH, (err) => {
      if (err) console.error(`Failed to setup GPIO${config.gpio.sensor1}:`, err.message);
      else console.log(`GPIO${config.gpio.sensor1} (sensor1) ready`);
    });
    gpioLib.setup(config.gpio.sensor2, gpioLib.DIR_IN, gpioLib.EDGE_BOTH, (err) => {
      if (err) console.error(`Failed to setup GPIO${config.gpio.sensor2}:`, err.message);
      else console.log(`GPIO${config.gpio.sensor2} (sensor2) ready`);
    });
  }
}

// Initialize GPIO
initializeGpio();

// Set up HTTP proxy
const p = proxy.createProxyServer();

const server = http.createServer((req, res) => {
  p.web(req, res, {
    target: 'https://' + config.dremUrl,
    headers: { Host: config.dremUrl },
    changeOrigin: true,
  });
});

server.listen(config.port);
console.log(`HTTP proxy server listening on port ${config.port}`);

// Set up WebSocket server
const wsServer = new ws.WebSocketServer({ server });

console.log('Timer started and ready');
wsServer.on('connection', (sock, req) => {
  sockets.add(sock);
  const clientIp = req.socket.remoteAddress;
  console.log(`WebSocket client connected from ${clientIp} (total clients: ${sockets.size})`);

  // Send server info to client
  try {
    sock.send(
      JSON.stringify({
        event: 'connected',
        timestamp: getTimestamp(),
        serverInfo: {
          gpioLibrary: useModernGpio ? 'node-libgpiod' : 'rpi-gpio',
          config: config,
        },
      })
    );
  } catch (e) {
    console.error('Error sending connection info:', e.message);
  }

  sock.on('close', () => {
    sockets.delete(sock);
    console.log(`WebSocket client disconnected (remaining clients: ${sockets.size})`);
  });

  sock.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    sockets.delete(sock);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');

  if (useModernGpio && gpioLines.length > 0) {
    console.log('Releasing GPIO lines...');
    if (gpioPollingInterval) {
      clearInterval(gpioPollingInterval);
      gpioPollingInterval = null;
    }
    for (const line of gpioLines) {
      try {
        line.release();
      } catch (e) {
        /* ignore cleanup errors */
      }
    }
    gpioChip = null;
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Log statistics every 60 seconds
setInterval(() => {
  console.log('Statistics:', {
    totalLaps: debugLapCounter,
    connectedClients: sockets.size,
    sensor1Count: sensorDebounce[config.gpio.sensor1].count,
    sensor2Count: sensorDebounce[config.gpio.sensor2].count,
  });
}, 60000);
