// Local-only preview with live reload. Run: node scripts/preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const documentPath = path.join(root, '포털_인터랙션.html');
const clients = new Set();
let version = Date.now(), pending;
const liveClient = `<script>(()=>{let previous;const events=new EventSource('/__preview_events');events.onmessage=e=>{if(previous&&previous!==e.data)location.reload();previous=e.data;};})();</script>`;
function changed(){
  clearTimeout(pending);
  pending = setTimeout(()=>{version=Date.now();for(const response of clients)response.write('data: '+version+'\n\n');},350);
}
fs.watch(root,(_,name)=>{if(name==='포털_인터랙션.html')changed();});
fs.watch(path.join(root,'assets'),changed);
const mime={'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);return response.end();}
  if(pathname==='/__preview_events'){
    response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    response.write('data: '+version+'\n\n');clients.add(response);request.on('close',()=>clients.delete(response));return;
  }
  if(pathname==='/favicon.ico'){response.writeHead(204);return response.end();}
  const isDocument=pathname==='/'||pathname==='/포털_인터랙션.html';
  const file=isDocument?documentPath:path.resolve(root,'.'+pathname);
  if(!isDocument&&(!pathname.startsWith('/assets/')||!file.startsWith(path.join(root,'assets')+path.sep))){response.writeHead(404);return response.end();}
  fs.readFile(file,(error,data)=>{
    if(error){response.writeHead(404);return response.end();}
    response.setHeader('Content-Type',isDocument?'text/html; charset=utf-8':mime[path.extname(file)]||'application/octet-stream');
    response.setHeader('Cache-Control','no-store');
    response.end(request.method==='HEAD'?undefined:isDocument?data.toString('utf8').replace('</body>',liveClient+'</body>'):data);
  });
});
const heartbeat=setInterval(()=>{for(const response of clients)response.write(': keepalive\n\n');},20000);heartbeat.unref();
server.listen(4187,'127.0.0.1',()=>console.log('Live preview: http://127.0.0.1:4187'));
