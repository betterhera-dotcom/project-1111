const http = require('node:http');
const { spawn } = require('node:child_process');
const url = 'http://localhost:4190/fairy-forest-v3.html';
function open() {
  console.log('Fairy Forest v3: ' + url);
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', () => console.log('Open this address in your browser: ' + url));
  browser.unref();
}
let started = false;
function start() {
  if (started) return;
  started = true;
  const server = require('../server.cjs');
  server.once('listening', open);
}
const request = http.request(url, { method: 'HEAD' }, response => {
  response.resume();
  if (response.statusCode === 200) open(); else start();
});
request.on('error', start);
request.setTimeout(1500, () => request.destroy());
request.end();
