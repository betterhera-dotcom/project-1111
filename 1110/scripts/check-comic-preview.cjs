// Developer-only visual QA: exercise the actual live filter on a supplied reference.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'포털_인터랙션.html'),'utf8');
const filter=source.slice(source.indexOf('function makeToonRenderer('),source.indexOf('function drawSubject('));
const reference=fs.readFileSync(path.join(root,'레퍼런스','1610241707548153.jpg')).toString('base64');
const page=`<!doctype html><html><meta charset="utf-8"><title>Comic filter QA</title>
<style>body{background:#10151d;color:#eee;font:16px system-ui;margin:30px}main{display:flex;gap:24px}figure{margin:0;flex:1}canvas{width:100%;image-rendering:auto}figcaption{padding:15px 0}#result{color:#ffbb77}</style>
<h1>Comic filter / visual verification</h1><p id="result">Rendering…</p><main><figure><canvas id="original"></canvas><figcaption>Supplied reference</figcaption></figure><figure><canvas id="comic"></canvas><figcaption>Live comic filter / no cloak</figcaption></figure></main>
<script>const person=document.createElement('canvas'),pc=person.getContext('2d');const paintedPerson=document.createElement('canvas'),paintCtx=paintedPerson.getContext('2d',{willReadFrequently:true});let toonRenderer=null,toonRendererTried=false;
${filter}
const image=new Image();image.onload=()=>{person.width=image.width;person.height=image.height;pc.drawImage(image,0,0);const before=document.querySelector('#original');before.width=image.width;before.height=image.height;before.getContext('2d').drawImage(image,0,0);const ok=paintPerson(),after=document.querySelector('#comic');after.width=paintedPerson.width;after.height=paintedPerson.height;after.getContext('2d').drawImage(paintedPerson,0,0);document.querySelector('#result').textContent=ok?(toonRenderer?'PASS / WebGL shader compiled and rendered':'PASS / software comic filter rendered'):'FAIL / filter did not render';};image.src='data:image/jpeg;base64,${reference}';</script></html>`;
http.createServer((request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(page);}).listen(4196,'127.0.0.1',()=>console.log('Comic QA: http://127.0.0.1:4196/'));
