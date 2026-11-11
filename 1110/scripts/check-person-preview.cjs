// Exercise the full camera -> segmentation -> comic -> portal pipeline without real camera access.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const reference=fs.readFileSync(path.join(root,'레퍼런스','1610241707548153.jpg')).toString('base64');
const fakeCamera=`(()=>{const original=navigator.mediaDevices;const devices=Object.create(original||null);devices.getUserMedia=async()=>{const image=new Image();image.src='data:image/jpeg;base64,${reference}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const stream=canvas.captureStream(12),timer=setInterval(()=>ctx.drawImage(image,0,0),80);for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}return stream;};Object.defineProperty(navigator,'mediaDevices',{value:devices,configurable:true});})();`;
http.createServer((request,response)=>{
 let html=fs.readFileSync(path.join(root,'포털_인터랙션_단일파일.html'),'utf8');
 html=html.replace('<script>','<script>'+fakeCamera+'</script><script>').replace('<body>','<body><div style="position:fixed;z-index:100;top:0;right:0;padding:5px 10px;background:#513516;color:#ffe4b8;font:11px system-ui;pointer-events:none">참고사진을 이용한 모의 카메라 검증</div>');
 response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);
}).listen(4198,'127.0.0.1',()=>console.log('Person pipeline QA: http://127.0.0.1:4198/'));
