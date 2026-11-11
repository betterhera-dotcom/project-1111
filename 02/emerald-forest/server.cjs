const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const artifact = path.resolve(root, '..', 'fairy-forest-v2.html');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (pathname.startsWith('/emerald-forest/')) pathname = pathname.slice('/emerald-forest'.length);
  const file = pathname === '/' || pathname === '/fairy-forest-v2.html' ? artifact : path.resolve(root, '.' + pathname);
  if (file !== artifact && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.listen(4190, '127.0.0.1', () => console.log('Emerald Reverie: http://127.0.0.1:4190'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
module.exports = server;
