const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','포털_인터랙션.html'),'utf8');
const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup({modelAvailable=true,deferred=false,handAvailable=true,cameraError=null,handDeferred=false}={}){
  const elements=new Map(),timers=new Map(),contexts=[],tracks=[],events=new Map(),sessionData=new Map();
  let clock=1000,sequence=0,firstPending=deferred,release,active=0,maxActive=0,firstHandPending=handDeferred,releaseHand;
  function context(){
    const operations=[],state=[],gradient={addColorStop(){}};
    const value={operations,globalCompositeOperation:'source-over',filter:'none',
      save(){state.push({composite:this.globalCompositeOperation,filter:this.filter});},
      restore(){const last=state.pop();if(last){this.globalCompositeOperation=last.composite;this.filter=last.filter;}},
      drawImage(image,...args){operations.push({type:'draw',image,args,composite:this.globalCompositeOperation,filter:this.filter,alpha:this.globalAlpha});},
      clearRect(...args){operations.push({type:'clear',args});},
      getImageData(x,y,width,height){const data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4){data[i]=133;data[i+1]=101;data[i+2]=77;data[i+3]=255;}return {width,height,data};},
      putImageData(image,...args){operations.push({type:'pixels',image,args});},
      bezierCurveTo(...args){operations.push({type:'bezier',args});},
      arc(...args){operations.push({type:'arc',args});},clip(){operations.push({type:'clip'});},
      translate(...args){operations.push({type:'translate',args});},scale(...args){operations.push({type:'scale',args});},
      createRadialGradient(){return gradient;},createLinearGradient(){return gradient;}
    };
    const proxy=new Proxy(value,{get:(target,key)=>key in target?target[key]:()=>{}});contexts.push(proxy);return proxy;
  }
  function element(id){
    const ctx=context(),listeners={};
    return {id,width:300,height:150,clientWidth:1280,clientHeight:504,videoWidth:1280,videoHeight:720,readyState:4,value:'80',tagName:'DIV',textContent:'',ctx,listeners,
      getContext(type){return type==='webgl'?null:ctx;},getBoundingClientRect(){return {left:0,top:82};},
      addEventListener(event,callback){listeners[event]=callback;},setAttribute(){},setPointerCapture(){},
      play(){return Promise.resolve();},click(){return this.onclick?.();},remove(){}};
  }
  function track(){const value={stopped:false,listeners:{},stop(){this.stopped=true;},addEventListener(event,callback){this.listeners[event]=callback;}};tracks.push(value);return value;}
  class Model{
    setOptions(){}onResults(callback){this.callback=callback;}
    send(){
      active++;maxActive=Math.max(maxActive,active);
      return new Promise(resolve=>{
        const finish=()=>{this.callback({image:{id:'camera-frame'},segmentationMask:{id:'person-matte'}});active--;resolve();};
        if(firstPending){firstPending=false;release=finish;}else finish();
      });
    }
  }
  class HandModel{setOptions(){}onResults(callback){this.callback=callback;}send(){return new Promise(resolve=>{const finish=()=>{this.callback({multiHandLandmarks:[],multiHandedness:[]});resolve();};if(firstHandPending){firstHandPending=false;releaseHand=finish;}else finish();});}}
  const sandbox={console,Math,Date,Promise,Uint8Array,Int32Array,innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    performance:{now:()=>clock},matchMedia:()=>({matches:false}),addEventListener(name,callback){events.set(name,callback);},
    sessionStorage:{getItem:key=>sessionData.get(key)??null,setItem:(key,value)=>sessionData.set(key,String(value)),removeItem:key=>sessionData.delete(key)},
    Image:class{complete=false;naturalWidth=0;},
    requestAnimationFrame(){},
    setTimeout(callback){const id=++sequence;timers.set(id,callback);return id;},clearTimeout(id){timers.delete(id);},
    navigator:{mediaDevices:{async getUserMedia(){if(cameraError){const error=new Error('camera unavailable');error.name=cameraError;throw error;}const cameraTrack=track();return {getTracks:()=>[cameraTrack],getVideoTracks:()=>[cameraTrack]};}}},
    document:{documentElement:{addEventListener(){}},
      querySelector(selector){if(!elements.has(selector))elements.set(selector,element(selector));return elements.get(selector);},
      createElement(type){return element(type);},head:{appendChild(tag){tag.onerror();}}}
  };
  if(modelAvailable)sandbox.SelfieSegmentation=Model;
  if(handAvailable)sandbox.Hands=HandModel;
  vm.createContext(sandbox);
  vm.runInContext(source+`\nthis.api={start:()=>cameraButton.onclick(),stop:stopCamera,frame,updatePerson,resize,describePalm,updatePalms,palmStagePoint,updatePalmDrawing,cameraPointInPortal,entrancePose,drawPalmSpells,drawPortalEntrance,restorePortalSession,processCamera,
    state:()=>({personReady,toonReady,handsReady,handBusy:!!handInFlight,palms:palms.length,personUpdated,cameraSession,processingSession,stream:!!stream,pw:person.width,ph:person.height,realmIndex:portal?.realmIndex,enteredAt:portal?.enteredAt,heroIndex:summonedHero?.heroIndex,heroX:summonedHero?.x,heroY:summonedHero?.y,handTrailLength:handTrail.length,drawingHand,handCooldownUntil}),
    personContext:pc,probeContext:personProbeCtx,paintContext:paintCtx,paintedPerson,person,subjectContext:subjectCtx,sceneContext:ctx,landscapeContext:landscapeCtx,worldContext:worldCtx,cosmosImage,snowImage,portalRealms,avengers};`,sandbox);
  function drawCircle(x=900,y=250,r=90){
    const events=elements.get('#scene').listeners;
    const point=a=>({pointerId:1,button:0,clientX:x+Math.cos(a)*r,clientY:y+Math.sin(a)*r+82});
    events.pointerdown(point(0));for(let i=1;i<=72;i++)events.pointermove(point(i*Math.PI*2/72));events.pointerup(point(Math.PI*2));
  }
  return {api:sandbox.api,elements,contexts,tracks,events,sessionData,drawCircle,setClock:value=>clock=value,release:()=>release(),releaseHand:()=>releaseHand(),maxActive:()=>maxActive};
}

test('room reconstruction and raw-video rendering are removed',()=>{
  assert.doesNotMatch(source,/known\[|drawCover|backgroundReady|const right=new Int32Array/);
  assert.match(html,/#camera\{display:none\}/);
  assert.match(html,/id="landscape"/);assert.match(html,/id="subject"/);assert.match(html,/id="spell-cursor"/);
});
test('a fresh alpha matte composites only the subject, with correct camera proportions',async()=>{
  const env=setup();await env.api.start();await flush();
  assert.equal(env.api.state().personReady,true);
  assert.equal(env.api.state().pw,640);assert.equal(env.api.state().ph,360);
  const draws=env.api.personContext.operations.filter(op=>op.type==='draw');
  assert.equal(draws.length,2);assert.equal(draws[0].image.id,'person-matte');assert.equal(draws[1].composite,'source-in');
  env.drawCircle();env.setClock(2000);env.api.updatePerson({image:{id:'fresh-frame'},segmentationMask:{id:'fresh-matte'}});env.api.frame(2000);
  assert.equal(env.api.subjectContext.operations.filter(op=>op.type==='draw').length,1);
  assert.equal(env.contexts.flatMap(ctx=>ctx.operations).some(op=>op.image===env.elements.get('#camera')),false);
  assert.equal(env.api.sceneContext.operations.filter(op=>op.type==='draw').length,0);
});
test('camera readiness opens a default portal and drawing relocates the subject',async()=>{
  const env=setup();await env.api.start();await flush();env.api.frame(1000);
  assert.equal(env.api.state().enteredAt,1000);assert.ok(!env.api.subjectContext.operations.some(op=>op.type==='draw'));
  env.setClock(2000);env.api.updatePerson({image:{},segmentationMask:{}});env.api.subjectContext.operations.length=0;env.api.frame(2000);
  assert.equal(env.api.subjectContext.operations.find(op=>op.type==='draw').alpha,1);
  assert.deepEqual([...env.api.subjectContext.operations.find(op=>op.type==='translate').args],[1280*.705,504*.49]);
  env.drawCircle(880,240,95);env.setClock(3000);env.api.updatePerson({image:{},segmentationMask:{}});
  env.api.subjectContext.operations.length=0;env.api.frame(3000);
  const ops=env.api.subjectContext.operations;
  const arc=ops.find(op=>op.type==='arc');assert.equal(arc.args[0],880);assert.equal(arc.args[1],240);assert.equal(arc.args[2],95);
  assert.ok(ops.findIndex(op=>op.type==='clip')<ops.findIndex(op=>op.type==='draw'));
  assert.deepEqual([...ops.find(op=>op.type==='translate').args],[880,240]);
  assert.deepEqual([...ops.find(op=>op.type==='draw').args],[-95,-95*360/640,190,190*360/640]);
  env.drawCircle(650,200,60);env.setClock(4000);env.api.updatePerson({image:{},segmentationMask:{}});
  env.api.subjectContext.operations.length=0;env.api.frame(4000);
  assert.deepEqual([...env.api.subjectContext.operations.find(op=>op.type==='arc').args].slice(0,3),[650,200,60]);
});
test('comic rendering replaces the photo, uses halftones, and has no cloak overlay',async()=>{
  const env=setup();await env.api.start();await flush();assert.equal(env.api.state().toonReady,true);
  const pixels=env.api.paintContext.operations.find(op=>op.type==='pixels');assert.ok(pixels);assert.notEqual(pixels.image.data[0],133);
  env.drawCircle();env.setClock(2000);env.api.updatePerson({image:{},segmentationMask:{}});env.api.frame(2000);
  const displayed=env.api.subjectContext.operations.filter(op=>op.type==='draw');assert.equal(displayed.length,1);assert.equal(displayed[0].image,env.api.paintedPerson);assert.notEqual(displayed[0].image,env.api.person);
  const data=pixels.image.data,width=pixels.image.width;
  assert.ok(data[(2*width+2)*4]<data[0],'shadow halftones must darken the dot centers');
  assert.ok(!env.api.subjectContext.operations.some(op=>op.type==='bezier'));
  assert.doesNotMatch(source,/drawCloak|cloakEnabled|capeProbe/);assert.doesNotMatch(html,/id="cloak"/);
  env.api.stop();assert.equal(env.api.state().toonReady,false);
});
test('cosmos stays behind the person inside the circle while snow remains outside',async()=>{
  const env=setup();await env.api.start();await flush();env.drawCircle(880,240,95);env.setClock(2000);
  for(const realm of env.api.portalRealms)Object.assign(realm.image,{complete:true,naturalWidth:1024,naturalHeight:1024});
  Object.assign(env.api.snowImage,{complete:true,naturalWidth:1672,naturalHeight:941});
  env.api.updatePerson({image:{},segmentationMask:{}});env.api.frame(2000);
  const world=env.api.worldContext.operations,draw=world.find(op=>op.type==='draw');
  assert.equal(draw.image,env.api.portalRealms[env.api.state().realmIndex].image);assert.deepEqual([...draw.args],[785,145,190,190]);
  assert.ok(world.findIndex(op=>op.type==='clip')<world.findIndex(op=>op.type==='draw'));
  assert.ok(env.api.landscapeContext.operations.some(op=>op.image===env.api.snowImage));
  assert.ok(env.api.subjectContext.operations.some(op=>op.type==='draw'));
  assert.match(html,/#portal-world\{z-index:1\}#subject\{z-index:2\}#scene\{z-index:3\}/);
  env.elements.get('#reset').click();env.api.worldContext.operations.length=0;env.api.frame(2000);
  assert.equal(env.api.worldContext.operations[0].type,'clear');assert.ok(!env.api.worldContext.operations.some(op=>op.type==='draw'));
});
test('stalled segmentation frames disappear instead of leaving a ghost',async()=>{
  const env=setup();await env.api.start();await flush();env.api.subjectContext.operations.length=0;
  env.api.frame(4500);
  assert.equal(env.api.subjectContext.operations[0].type,'clear');
  assert.equal(env.api.subjectContext.operations.filter(op=>op.type==='draw').length,0);
});
test('an empty foreground is reported and cannot leave a stale person on screen',async()=>{
 const env=setup();await env.api.start();await flush();
 env.api.probeContext.getImageData=(x,y,width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)});
 env.api.updatePerson({image:{},segmentationMask:{}});assert.equal(env.api.state().personReady,false);assert.equal(env.api.state().toonReady,false);
 assert.match(env.elements.get('#status').textContent,/인물을 찾는 중/);env.api.subjectContext.operations.length=0;env.api.frame(2000);assert.ok(!env.api.subjectContext.operations.some(op=>op.type==='draw'));
});
test('each ten openings visit every world without adjacent repeats',()=>{
  const env=setup(),ids=[];let previous=env.api.state().realmIndex;
  assert.equal(env.api.portalRealms.length,10);
  for(let i=0;i<80;i++){
    if(i%2)env.elements.get('#demo').click();else env.drawCircle();
    const current=env.api.state().realmIndex;assert.notEqual(current,previous);ids.push(current);previous=current;
    env.api.resize();assert.equal(env.api.state().realmIndex,current);
  }
  for(let i=0;i<ids.length;i+=10)assert.equal(new Set(ids.slice(i,i+10)).size,10);
});
test('all ten destinations have unique labels and local background assets',()=>{
  const {portalRealms}=setup().api;
  assert.equal(new Set(portalRealms.map(realm=>realm.label)).size,10);
  const images=portalRealms.map(realm=>realm.image.src);
  assert.equal(new Set(images).size,10);
  for(const image of images){
    assert.ok(image.startsWith('assets/'));
    assert.ok(fs.existsSync(path.join(__dirname,'..',image)),image+' must exist');
  }
});
function traceStroke(env,points){
  const events=env.elements.get('#scene').listeners;
  const event=point=>({pointerId:1,button:0,clientX:point.x,clientY:point.y+82});
  events.pointerdown(event(points[0]));
  for(const point of points.slice(1))events.pointermove(event(point));
  events.pointerup(event(points.at(-1)));
}
function circleStroke({steps=48,turn=Math.PI*2,rx=90,ry=rx}={}){
  return Array.from({length:steps+1},(_,i)=>({x:900+Math.cos(i*turn/steps)*rx,y:250+Math.sin(i*turn/steps)*ry}));
}
test('quick, small, slightly open, and hand-drawn oval circles open portals',()=>{
  for(const options of [{steps:10},{rx:28},{turn:Math.PI*5/3},{rx:110,ry:72}]){
    const env=setup();env.elements.get('#reset').click();
    traceStroke(env,circleStroke(options));
    assert.equal(env.elements.get('#stage-state').textContent,'GATEWAY ESTABLISHED',JSON.stringify(options));
  }
});
test('coalesced pointer samples preserve a fast circular gesture',()=>{
  const env=setup();env.elements.get('#reset').click();
  const events=env.elements.get('#scene').listeners,points=circleStroke();
  const event=point=>({pointerId:1,button:0,clientX:point.x,clientY:point.y+82});
  events.pointerdown(event(points[0]));
  events.pointermove({...event(points.at(-1)),getCoalescedEvents:()=>points.slice(1).map(event)});
  events.pointerup(event(points.at(-1)));
  assert.equal(env.elements.get('#stage-state').textContent,'GATEWAY ESTABLISHED');
});
test('a click, straight stroke, or half circle cannot open a portal',()=>{
  for(const points of [[{x:900,y:250}],Array.from({length:30},(_,i)=>({x:800+i*7,y:250})),circleStroke({turn:Math.PI})]){
    const env=setup();env.elements.get('#reset').click();traceStroke(env,points);
    assert.equal(env.elements.get('#stage-state').textContent,'AWAITING GESTURE');
    assert.equal(env.api.state().realmIndex,undefined);
  }
});
function triangleStroke({angle=0,start=0,wobble=0,steps=14}={}){
  const vertices=[{x:0,y:-100},{x:100,y:80},{x:-100,y:80}];
  const points=[];
  for(let side=0;side<3;side++)for(let i=0;i<steps;i++){
    const a=vertices[side],b=vertices[(side+1)%3],t=i/steps;
    const x=a.x+(b.x-a.x)*t+Math.sin(i*1.7)*wobble,y=a.y+(b.y-a.y)*t+Math.cos(i*1.3)*wobble;
    points.push({x:900+x*Math.cos(angle)-y*Math.sin(angle),y:250+x*Math.sin(angle)+y*Math.cos(angle)});
  }
  const ordered=points.slice(start).concat(points.slice(0,start));return [...ordered,ordered[0]];
}
test('triangles summon four distinct Avengers without a circle portal',()=>{
  const env=setup(),seen=new Set();
  for(const options of [{},{angle:1.1},{start:7},{wobble:4}]){
    traceStroke(env,triangleStroke(options));
    assert.equal(env.elements.get('#stage-state').textContent,'AVENGER SUMMONED');
    assert.equal(env.api.state().realmIndex,undefined);
    seen.add(env.api.state().heroIndex);
  }
  assert.equal(seen.size,4);
  traceStroke(env,circleStroke());
  assert.equal(env.api.state().heroIndex,undefined);
  assert.equal(env.elements.get('#stage-state').textContent,'GATEWAY ESTABLISHED');
});
test('a hero renders without webcam access and reset clears the summon',()=>{
  const env=setup();traceStroke(env,triangleStroke());
  const hero=env.api.avengers[env.api.state().heroIndex];
  Object.assign(hero.image,{complete:true,naturalWidth:1024,naturalHeight:1536});
  env.api.subjectContext.operations.length=0;env.api.frame(2000);
  assert.ok(env.api.subjectContext.operations.some(op=>op.type==='draw'&&op.image===hero.image));
  assert.equal(env.tracks.length,0);
  env.elements.get('#reset').click();assert.equal(env.api.state().heroIndex,undefined);
  env.api.subjectContext.operations.length=0;env.api.frame(3000);
  assert.ok(!env.api.subjectContext.operations.some(op=>op.type==='draw'));
});
test('the four Avengers use distinct local official character images',()=>{
  const {avengers}=setup().api;
  assert.equal(avengers.length,4);assert.equal(new Set(avengers.map(hero=>hero.image.src)).size,4);
  for(const hero of avengers){
    const bytes=fs.readFileSync(path.join(__dirname,'..',hero.image.src));
    assert.ok(bytes.length>1000);assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  }
});
test('camera readiness and resizing preserve a summoned hero',async()=>{
  const env=setup();traceStroke(env,triangleStroke());const index=env.api.state().heroIndex;
  await env.api.start();await flush();assert.equal(env.api.state().heroIndex,index);
  assert.equal(env.api.state().realmIndex,undefined);
  const workspace=env.elements.get('#workspace');workspace.clientWidth=640;workspace.clientHeight=400;
  env.api.resize();assert.equal(env.api.state().heroIndex,index);
  assert.ok(env.api.state().heroX<=640&&env.api.state().heroY<=400);
});
test('disconnect clears the subject and rejects late callbacks',async()=>{
  const env=setup();await env.api.start();await flush();env.api.stop();
  env.api.updatePerson({image:{},segmentationMask:{}});
  assert.equal(env.api.state().personReady,false);assert.equal(env.api.state().stream,false);
  assert.ok(env.tracks.every(track=>track.stopped));
  env.api.subjectContext.operations.length=0;env.api.frame(1000);
  assert.equal(env.api.subjectContext.operations.filter(op=>op.type==='draw').length,0);
});
test('reconnect serializes model work and ignores the previous camera session',async()=>{
  const env=setup({deferred:true});await env.api.start();await flush();
  env.api.stop();await env.api.start();await flush();
  assert.equal(env.api.state().personReady,false);
  env.release();await flush();
  assert.equal(env.api.state().personReady,true);assert.equal(env.maxActive(),1);
});
test('portrait cameras preserve aspect ratio and model failure never reveals the room',async()=>{
  const env=setup();const camera=env.elements.get('#camera');camera.videoWidth=720;camera.videoHeight=1280;
  await env.api.start();await flush();assert.equal(env.api.state().pw,270);assert.equal(env.api.state().ph,480);
  const unavailable=setup({modelAvailable:false});await unavailable.api.start();await flush();
  assert.equal(unavailable.api.state().stream,false);assert.equal(unavailable.api.state().personReady,false);
  assert.match(unavailable.elements.get('#status').textContent,/인물 분리를 불러오지 못했어요/);
});
function openHand(){
 const points=Array.from({length:21},()=>({x:.5,y:.7}));points[0]={x:.5,y:.85};
 for(const [mcp,pip,tip,x,y] of [[5,6,8,.4,.65],[9,10,12,.48,.62],[13,14,16,.56,.65],[17,18,20,.64,.7]]){points[mcp]={x,y};points[pip]={x,y:y-.15};points[tip]={x,y:y-.33};}
 return points;
}
function feedPalmAt(env,x,y,time,label='Right'){
 const hand=openHand(),center=[0,5,9,13,17].reduce((sum,i)=>({x:sum.x+hand[i].x/5,y:sum.y+hand[i].y/5}),{x:0,y:0});
 const workspace=env.elements.get('#workspace'),camera=env.elements.get('#camera'),scale=Math.min(workspace.clientWidth/camera.videoWidth,workspace.clientHeight/camera.videoHeight);
 const px=1-(x-(workspace.clientWidth-camera.videoWidth*scale)/2)/(camera.videoWidth*scale),py=(y-(workspace.clientHeight-camera.videoHeight*scale)/2)/(camera.videoHeight*scale);
 env.setClock(time);env.api.updatePalms({multiHandLandmarks:[hand.map(point=>({x:point.x+px-center.x,y:point.y+py-center.y}))],multiHandedness:[{label}]});
}
test('an open palm draws a full circle and opens a portal automatically',async()=>{
 const env=setup();await env.api.start();await flush();const before=env.api.state().realmIndex;
 for(let i=0;i<=48;i++){
  const angle=i*Math.PI*2/48;feedPalmAt(env,830+Math.cos(angle)*60,300+Math.sin(angle)*60,2000+i*100);
  if(i===24)assert.equal(env.api.state().realmIndex,before,'a half circle must not trigger');
 }
 assert.notEqual(env.api.state().realmIndex,before);
 assert.equal(env.api.state().heroIndex,undefined);
 assert.equal(env.elements.get('#stage-state').textContent,'GATEWAY ESTABLISHED');
 const opened=env.api.state().realmIndex;
 for(let i=0;i<8;i++)feedPalmAt(env,890,300,7000+i*100);
 assert.equal(env.api.state().realmIndex,opened,'holding the hand still must not reopen the portal');
});
test('a short approach before the hand circle does not prevent recognition',async()=>{
 const env=setup();await env.api.start();await flush();const before=env.api.state().realmIndex;
 for(let i=0;i<10;i++)feedPalmAt(env,680+i*21,200+i*10,2000+i*100);
 for(let i=0;i<=48;i++){const angle=i*Math.PI*2/48;feedPalmAt(env,890+Math.cos(angle)*60,300+Math.sin(angle)*60,3000+i*100);}
 assert.notEqual(env.api.state().realmIndex,before);
});
test('hand loss, switching hands, and stopping the camera cannot join unrelated strokes',async()=>{
 const env=setup();await env.api.start();await flush();
 for(let i=0;i<10;i++)feedPalmAt(env,700+i*8,270,2000+i*100);
 assert.ok(env.api.state().handTrailLength>1);
 env.setClock(3500);env.api.updatePalms({multiHandLandmarks:[]});assert.equal(env.api.state().handTrailLength,0);
 feedPalmAt(env,900,300,4000,'Left');assert.equal(env.api.state().drawingHand,'Left');
 feedPalmAt(env,920,300,4100,'Right');assert.equal(env.api.state().drawingHand,'Left','a new hand must not take over the old stroke immediately');
 feedPalmAt(env,920,300,4700,'Right');assert.equal(env.api.state().drawingHand,'Right');assert.equal(env.api.state().handTrailLength,1);
 env.api.stop();assert.equal(env.api.state().handTrailLength,0);assert.equal(env.api.state().drawingHand,null);
 assert.ok(env.tracks.every(track=>track.stopped));
});
test('mouse drawing takes priority and hand mapping preserves portrait proportions',async()=>{
 const env=setup();await env.api.start();await flush();feedPalmAt(env,800,300,2000);
 const events=env.elements.get('#scene').listeners;
 events.pointerdown({pointerId:1,button:0,clientX:900,clientY:332});
 feedPalmAt(env,850,300,2100);assert.equal(env.api.state().handTrailLength,0);
 events.pointercancel();
 const workspace=env.elements.get('#workspace');workspace.clientWidth=390;workspace.clientHeight=760;env.api.resize();
 const center=env.api.palmStagePoint({x:.5,y:.5,span:.1}),horizontal=env.api.palmStagePoint({x:.6,y:.5,span:.1}),vertical=env.api.palmStagePoint({x:.5,y:.5+.1*1280/720,span:.1});
 assert.ok(Math.abs(Math.hypot(horizontal.x-center.x,horizontal.y-center.y)-Math.hypot(vertical.x-center.x,vertical.y-center.y))<.001);
 assert.ok(horizontal.x<center.x,'the hand cursor must mirror the camera');
});
test('an open palm summons a mirrored spell before entry, and a fist removes it',async()=>{
 const env=setup();await env.api.start();await flush();assert.equal(env.api.state().handsReady,true);
 const landmarks=openHand();assert.ok(env.api.describePalm(landmarks));
 env.api.updatePalms({multiHandLandmarks:[landmarks],multiHandedness:[{label:'Right'}]});assert.equal(env.api.state().palms,1);
 env.api.sceneContext.operations.length=0;env.api.drawPalmSpells(1200,1200);assert.ok(env.api.sceneContext.operations.some(op=>op.type==='arc'));
 const point=env.api.cameraPointInPortal({x:.25,y:.5,span:.2},1200);assert.ok(point.x>1280*.705,'camera coordinates must be mirrored');
 env.elements.get('#reset').click();env.api.sceneContext.operations.length=0;env.api.drawPalmSpells(1200,1200);assert.ok(env.api.sceneContext.operations.some(op=>op.type==='arc'),'hand response must work without a portal');
 for(const [mcp,tip] of [[5,8],[9,12],[13,16],[17,20]])landmarks[tip]={...landmarks[mcp]};
 assert.equal(env.api.describePalm(landmarks),null);env.api.updatePalms({multiHandLandmarks:[landmarks]});assert.equal(env.api.state().palms,0);
});
test('hand model failure does not disable the camera or comic rendering',async()=>{
 const env=setup({handAvailable:false});await env.api.start();await flush();assert.equal(env.api.state().stream,true);assert.equal(env.api.state().toonReady,true);assert.equal(env.api.state().handsReady,false);
 assert.match(env.elements.get('#hand-status').textContent,/손 인식을 불러오지 못했어요/);
});
test('slow hand-model warmup does not freeze the person video', {timeout:2000},async()=>{
 const env=setup({handDeferred:true});await env.api.start();await flush();assert.equal(env.api.state().handBusy,true);assert.equal(env.api.state().toonReady,true);
 env.setClock(2000);await env.api.processCamera(env.api.state().cameraSession);assert.equal(env.api.state().personUpdated,2000);assert.equal(env.api.state().handBusy,true);
 env.releaseHand();await flush();assert.equal(env.api.state().handBusy,false);env.api.stop();
});
test('entry animation starts when the person becomes ready and settles once',async()=>{
 const env=setup();env.drawCircle();assert.equal(env.api.state().enteredAt,null);
 env.setClock(2000);await env.api.start();await flush();assert.equal(env.api.state().enteredAt,2000);
 assert.equal(env.api.entrancePose(2000).opacity,0);assert.ok(env.api.entrancePose(2450).zoom<1);assert.equal(env.api.entrancePose(2900).zoom,1);
 env.setClock(3100);env.api.updatePerson({image:{},segmentationMask:{}});assert.equal(env.api.state().enteredAt,2000);
});
test('refresh restores an already connected camera, but manual disconnect clears resume intent',async()=>{
 const env=setup();await env.api.start();await flush();env.drawCircle();env.events.get('pagehide')();assert.equal(env.sessionData.get('portal-resume-camera'),'1');assert.equal(env.api.state().stream,false);
 env.api.restorePortalSession();await flush();assert.equal(env.api.state().stream,true);assert.equal(env.sessionData.has('portal-resume-camera'),false);
 env.api.stop();assert.equal(env.sessionData.has('portal-resume-camera'),false);
});
test('device-busy camera failures show a concrete recovery message',async()=>{
 const env=setup({cameraError:'NotReadableError'});await env.api.start();await flush();assert.equal(env.api.state().stream,false);assert.match(env.elements.get('#status').textContent,/다른 앱이나 브라우저/);
});
