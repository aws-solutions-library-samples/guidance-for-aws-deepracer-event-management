const http = require('http');

const proxy = require('http-proxy');
const gpio = require('rpi-gpio');
const ws = require('ws');

drem = 'dremURL';

console.log('Starting timer...');
const sockets = new Set();

let debounce;
let debugLapCounter = 1;
gpio.on('change', function (channel, value) {
  if (debounce) return;
  debounce = true;
  setTimeout(() => {
    debounce = false;
  }, 3000);

  for (const sock of sockets) {
    try {
      console.log(++debugLapCounter + ': Lap triggered');
      sock.send('lap');
    } catch (e) {}
  }
});

gpio.setup(11, gpio.DIR_IN, gpio.EDGE_BOTH);
gpio.setup(13, gpio.DIR_IN, gpio.EDGE_BOTH);

const p = proxy.createProxyServer();

const server = http.createServer((req, res) => {
  p.web(req, res, { target: 'https://' + drem, headers: { Host: drem } });
});

server.listen(8080);

const wsServer = new ws.WebSocketServer({ server });

console.log('Timer started');
wsServer.on('connection', (sock) => {
  sockets.add(sock);

  sock.on('close', () => {
    sockets.delete(sock);
    console.log('Timer stopped');
  });
});
