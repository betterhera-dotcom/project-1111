const canvas = document.querySelector('#magic');
const ctx = canvas.getContext('2d');
const root = document.documentElement;
const forest = document.querySelector('#forest');
const cameraButton = document.querySelector('#camera');
const cameraLabel = document.querySelector('#camera-label');
const cameraStatus = document.querySelector('#camera-status');
const video = document.querySelector('#webcam');
const monitor = document.querySelector('#camera-monitor');
const tracking = document.querySelector('#tracking');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let width, height, lastFrame = performance.now();
let lastMove = performance.now() - 900, presence = .8;
let pointer = { x: innerWidth * .66, y: innerHeight * .43 };
let fairy = { ...pointer }, particles = [], spawn = 0;
let stream = null, detector = null, detectorPromise = null;
let cameraSession = 0, cameraStarting = false, face = null;
let lastDetection = 0, lastVideoTime = -1, faceSeenAt = 0;

function resize() {
  width = innerWidth;
  height = document.querySelector('#experience').clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pointer.x = Math.min(pointer.x, width - 25);
  pointer.y = Math.min(pointer.y, height - 25);
}
addEventListener('resize', resize);
resize();

function wake(event) {
  if (event.target.closest('button, a, .studio')) return;
  const bounds = canvas.getBoundingClientRect();
  pointer.x = Math.max(30, Math.min(width - 30, event.clientX - bounds.left));
  pointer.y = Math.max(60, Math.min(height - 60, event.clientY - bounds.top));
  lastMove = performance.now();
}
document.querySelector('#experience').addEventListener('pointermove', wake);
document.querySelector('#experience').addEventListener('pointerdown', wake);
addEventListener('keydown', event => {
  if (event.code === 'Space' && !event.target.closest('button, input, a')) {
    event.preventDefault();
    lastMove = performance.now();
    pointer = { x: width * .66, y: height * .42 };
  }
});

function glow(x, y, radius, opacity) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(179,255,183,${opacity})`);
  gradient.addColorStop(.2, `rgba(69,239,161,${opacity * .5})`);
  gradient.addColorStop(1, 'rgba(0,132,85,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function star(x, y, radius, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#eaffc1';
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.quadraticCurveTo(radius * .15, -radius * .15, radius, 0);
  ctx.quadraticCurveTo(radius * .15, radius * .15, 0, radius);
  ctx.quadraticCurveTo(-radius * .15, radius * .15, -radius, 0);
  ctx.quadraticCurveTo(-radius * .15, -radius * .15, 0, -radius);
  ctx.fill();
  ctx.restore();
}

function wing(side, time) {
  ctx.save();
  ctx.scale(side * (reducedMotion.matches ? .85 : .74 + Math.sin(time * .023) * .23), 1);
  const fill = ctx.createLinearGradient(0, 0, 100, -70);
  fill.addColorStop(0, '#ccffd455');
  fill.addColorStop(.55, '#81f1bf40');
  fill.addColorStop(1, '#e9ffd515');
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#d0ffd38c';
  ctx.lineWidth = .7;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(18, -61, 64, -99, 91, -84);
  ctx.bezierCurveTo(113, -51, 49, -17, 0, -1);
  ctx.bezierCurveTo(50, -24, 83, -8, 65, 25);
  ctx.bezierCurveTo(42, 52, 11, 17, 0, -10);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c3ffd14d';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(2, -8);
    ctx.quadraticCurveTo(38 + i * 5, -20 - i * 11, 85 - i * 9, -76 + i * 10);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(2, -5); ctx.quadraticCurveTo(35, 3, 57, 24); ctx.stroke();
  star(70, -61, 2, .65);
  ctx.restore();
}

function drawFace() {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, -38, 10.5, 13.5, 0, 0, Math.PI * 2); ctx.clip();
  if (face && stream && video.readyState >= 2) {
    ctx.translate(0, -38);
    ctx.scale(-1, 1);
    ctx.drawImage(video, face.x, face.y, face.w, face.h, -11, -14, 22, 28);
    ctx.fillStyle = '#a1edb51a'; ctx.fillRect(-11, -14, 22, 28);
  } else {
    const skin = ctx.createLinearGradient(-10, -52, 10, -24);
    skin.addColorStop(0, '#faf0cd'); skin.addColorStop(1, '#baa67b');
    ctx.fillStyle = skin; ctx.fillRect(-11, -52, 22, 28);
    ctx.strokeStyle = '#506c52'; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-7, -38); ctx.quadraticCurveTo(-4, -35, -1, -38);
    ctx.moveTo(2, -38); ctx.quadraticCurveTo(5, -35, 8, -38); ctx.stroke();
    ctx.strokeStyle = '#a07762'; ctx.beginPath(); ctx.arc(0, -34, 3, .3, 2.8); ctx.stroke();
  }
  ctx.restore();
}

function drawFairy(x, y, scale, time, alpha, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);
  ctx.globalAlpha = alpha;
  glow(0, -30, 135, .27);
  // A luminous aureole sits behind the head and wings.
  ctx.save(); ctx.translate(0, -35); ctx.rotate(time * .00012);
  ctx.strokeStyle = '#e4fbc976'; ctx.lineWidth = .65;
  ctx.beginPath(); ctx.arc(0, 0, 53, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#b0e6a42e'; ctx.beginPath(); ctx.arc(0, 0, 59, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    star(Math.cos(angle) * 58, Math.sin(angle) * 58, i % 3 ? 1.8 : 4, .8);
  }
  ctx.restore();
  wing(-1, time); wing(1, time);
  ctx.strokeStyle = '#d1dbb2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -13); ctx.quadraticCurveTo(-20, -1, -27, -11);
  ctx.moveTo(6, -13); ctx.quadraticCurveTo(20, 0, 28, -10); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-4, 31); ctx.quadraticCurveTo(-9, 46, -15, 55);
  ctx.moveTo(4, 31); ctx.quadraticCurveTo(6, 49, 1, 61); ctx.stroke();
  const dress = ctx.createLinearGradient(0, -23, 0, 41);
  dress.addColorStop(0, '#def9b7'); dress.addColorStop(.35, '#7fe4ad'); dress.addColorStop(1, '#238f6977');
  ctx.fillStyle = dress; ctx.beginPath();
  ctx.moveTo(-4, -25); ctx.quadraticCurveTo(-12, -15, -7, 0);
  ctx.quadraticCurveTo(-11, 22, -25, 39);
  ctx.quadraticCurveTo(-9, 32, -4, 42);
  ctx.quadraticCurveTo(4, 32, 9, 41);
  ctx.quadraticCurveTo(18, 31, 25, 37);
  ctx.quadraticCurveTo(10, 15, 7, 0); ctx.quadraticCurveTo(12, -15, 4, -25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d3f3b969'; ctx.lineWidth = .7;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(i * 10, 18, i * 18, 36); ctx.stroke(); }
  ctx.fillStyle = '#c6c58b'; ctx.beginPath(); ctx.ellipse(0, -39, 14, 17, 0, 0, Math.PI * 2); ctx.fill();
  drawFace();
  ctx.strokeStyle = '#ddf3b6'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-11, -48); ctx.lineTo(-9, -57); ctx.lineTo(-3, -51); ctx.lineTo(0, -60); ctx.lineTo(4, -51); ctx.lineTo(10, -56); ctx.lineTo(11, -48); ctx.stroke();
  star(0, -55, 3, 1); glow(28, -11, 18, .4);
  ctx.restore();
}

function detectFace(now) {
  if (!detector || !stream || video.readyState < 2 || now - lastDetection < 100 || video.currentTime === lastVideoTime) return;
  lastDetection = now;
  lastVideoTime = video.currentTime;
  try {
    const detections = detector.detectForVideo(video, now).detections;
    const best = detections.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
    if (best) {
      const box = best.boundingBox;
      const x = Math.max(0, box.originX + box.width * .08);
      const y = Math.max(0, box.originY - box.height * .04);
      const crop = { x, y, w: Math.min(box.width * .84, video.videoWidth - x), h: Math.min(box.height * 1.07, video.videoHeight - y) };
      if (face) for (const key of ['x', 'y', 'w', 'h']) face[key] += (crop[key] - face[key]) * .45;
      else face = crop;
      faceSeenAt = now;
      tracking.textContent = '얼굴 인식 중 · 요정에 적용됨';
    } else if (now - faceSeenAt > 350) {
      face = null;
      tracking.textContent = '얼굴을 카메라에 보여 주세요';
    }
  } catch {
    stopCamera();
    cameraStatus.textContent = '얼굴 인식이 중단됐어요. 카메라를 다시 켜 주세요.';
  }
}

function animate(now) {
  const dt = Math.min((now - lastFrame) / 1000, .05);
  lastFrame = now;
  const idle = now - lastMove;
  const target = idle < 800 ? 1 : Math.max(0, 1 - (idle - 800) / 4300);
  presence += (target - presence) * (1 - Math.exp(-dt * 4));
  root.style.setProperty('--presence', presence.toFixed(3));
  const state = presence > .65 ? '당신의 움직임으로 숲이 깨어나요' : presence > .04 ? '빛이 천천히 어둠으로 스며들어요' : '숲이 당신을 기다리고 있어요';
  const stateLabel = document.querySelector('#scene-state');
  if (stateLabel.textContent !== state) stateLabel.textContent = state;
  ctx.clearRect(0, 0, width, height);
  const ease = 1 - Math.exp(-dt * (reducedMotion.matches ? 12 : 3.3));
  fairy.x += (pointer.x - fairy.x) * ease;
  fairy.y += (pointer.y - fairy.y) * ease;
  detectFace(now);
  if (presence > .005) {
    glow(fairy.x, fairy.y - 30, Math.min(width * .5, 450), .14 * presence);
    ctx.globalAlpha = presence;
    for (let i = 0; i < 38; i++) {
      const x = ((i * 137.5 + Math.sin(now * .00015 + i) * 17) % width + width) % width;
      const y = (i * 83.4 - now * .006 * (1 + i % 3)) % height;
      star(x, (y + height) % height, i % 7 === 0 ? 3 : 1.2, .2 + .4 * (1 + Math.sin(now * .001 + i)) / 2);
    }
    const bob = reducedMotion.matches ? 0 : Math.sin(now * .003) * 7;
    const tilt = Math.max(-.15, Math.min(.15, (pointer.x - fairy.x) * .001));
    drawFairy(fairy.x, fairy.y + bob, width < 640 ? .85 : 1.2, now, presence, tilt);
    if (!reducedMotion.matches) {
      drawFairy(fairy.x + Math.cos(now * .00055 + 2) * 160, fairy.y - 30 + Math.sin(now * .0007) * 80, .36, now + 700, presence * .48, -.15);
      drawFairy(fairy.x + Math.cos(now * .0004 + 5) * 220, fairy.y + 65 + Math.sin(now * .0006 + 2) * 65, .24, now + 1400, presence * .3, .2);
    }
    spawn += dt;
    if (idle < 1200 && spawn > .025 && !reducedMotion.matches) {
      spawn = 0;
      for (let i = 0; i < 3; i++) particles.push({ x: fairy.x + (Math.random() - .5) * 35, y: fairy.y + (Math.random() - .5) * 55, vx: (Math.random() - .5) * 23, vy: 10 + Math.random() * 25, life: 1, size: 1 + Math.random() * 3 });
    }
  }
  particles = particles.filter(p => p.life > 0).slice(-220);
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * .45;
    ctx.globalAlpha = presence;
    star(p.x, p.y, p.size * p.life, p.life * .8);
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

async function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('./assets/vision/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks('./assets/vision');
      return FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: './assets/vision/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .55,
      });
    })().catch(error => { detectorPromise = null; throw error; });
  }
  return detectorPromise;
}

function stopCamera() {
  cameraSession++;
  cameraStarting = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  face = null;
  lastVideoTime = -1;
  monitor.hidden = true;
  cameraButton.setAttribute('aria-pressed', 'false');
  cameraLabel.textContent = '나의 얼굴로 요정 깨우기';
  cameraStatus.textContent = '카메라가 꺼졌어요. 기본 요정으로 돌아갑니다.';
}

cameraButton.addEventListener('click', async () => {
  if (stream || cameraStarting) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !isSecureContext) {
    cameraStatus.textContent = '웹캠은 localhost 또는 HTTPS 주소에서 사용할 수 있어요.';
    return;
  }
  const session = ++cameraSession;
  cameraStarting = true;
  cameraLabel.textContent = '준비 중 · 눌러서 취소';
  cameraStatus.textContent = '카메라 권한을 허용해 주세요. 얼굴 인식을 준비하고 있어요.';
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (session !== cameraSession) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    if (session !== cameraSession) return;
    detector = await loadDetector();
    if (session !== cameraSession) return;
    cameraStarting = false;
    monitor.hidden = false;
    cameraButton.setAttribute('aria-pressed', 'true');
    cameraLabel.textContent = '요정 얼굴 끄기';
    tracking.textContent = '얼굴을 찾고 있어요';
    cameraStatus.textContent = '자동으로 얼굴을 찾아 요정에 비춰요. 영상은 저장되지 않아요.';
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (session === cameraSession) stopCamera(); });
    lastMove = performance.now();
  } catch (error) {
    if (session !== cameraSession) return;
    stopCamera();
    cameraStatus.textContent = error.name === 'NotAllowedError' ? '카메라 권한이 꺼져 있어요. 브라우저에서 허용 후 다시 눌러 주세요.' : error.name === 'NotFoundError' ? '연결된 카메라를 찾지 못했어요.' : error.name === 'NotReadableError' ? '다른 앱이 카메라를 사용 중인지 확인해 주세요.' : '카메라 또는 얼굴 인식을 시작하지 못했어요. 다시 시도해 주세요.';
  }
});
addEventListener('pagehide', stopCamera);

const fileInput = document.querySelector('#forest-file');
const imageStatus = document.querySelector('#image-status');
const reset = document.querySelector('#reset');
let forestUrl = null, imageRequest = 0;
document.querySelector('#upload').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const request = ++imageRequest;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    imageStatus.textContent = '20 MB 이하 JPG, PNG, WEBP를 선택해 주세요.';
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (request !== imageRequest) { URL.revokeObjectURL(url); return; }
    if (forestUrl) URL.revokeObjectURL(forestUrl);
    forestUrl = url;
    forest.style.backgroundImage = `url("${url}")`;
    imageStatus.textContent = file.name;
    imageStatus.title = file.name;
    reset.hidden = false;
    lastMove = performance.now();
  } catch {
    URL.revokeObjectURL(url);
    if (request === imageRequest) imageStatus.textContent = '이미지를 읽지 못했어요. 다른 파일을 선택해 주세요.';
  }
});
reset.addEventListener('click', () => {
  imageRequest++;
  forest.style.backgroundImage = '';
  if (forestUrl) URL.revokeObjectURL(forestUrl);
  forestUrl = null;
  imageStatus.textContent = '꿈꾸는 숲 · 기본 배경'; imageStatus.title = '';
  reset.hidden = true;
  lastMove = performance.now();
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#experience').requestFullscreen();
  } catch { document.querySelector('#scene-state').textContent = '이 브라우저는 전체 화면을 지원하지 않아요.'; }
});
document.addEventListener('fullscreenchange', () => {
  document.querySelector('#fullscreen').innerHTML = document.fullscreenElement ? '화면 돌아가기 <span>⛶</span>' : '전체 화면 <span>⛶</span>';
});
