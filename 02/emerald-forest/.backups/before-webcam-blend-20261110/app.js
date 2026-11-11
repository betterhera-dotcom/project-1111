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
let lastMove = -Infinity, presence = 0, forestLight = .74;
let pointerInside = false, hasEntered = false;
const fairySprite = new Image();
fairySprite.src = './assets/fairy-storybook-v1.png';
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
  if (event.pointerType === 'touch' && event.type === 'pointermove' && !event.buttons) return;
  const bounds = canvas.getBoundingClientRect();
  const margin = width < 640 ? 95 : 140;
  pointer.x = Math.max(margin, Math.min(width - margin, event.clientX - bounds.left));
  pointer.y = Math.max(margin, Math.min(height - margin, event.clientY - bounds.top));
  lastMove = performance.now();
  pointerInside = true;
  hasEntered = true;
}
document.querySelector('#experience').addEventListener('pointermove', wake);
document.querySelector('#experience').addEventListener('pointerdown', wake);
function rest() { pointerInside = false; }
document.querySelector('#experience').addEventListener('pointerleave', rest);
document.querySelector('#experience').addEventListener('pointercancel', rest);
document.querySelector('#experience').addEventListener('pointerup', event => {
  if (event.pointerType === 'touch') rest();
});
addEventListener('blur', rest);
document.addEventListener('visibilitychange', () => { if (document.hidden) rest(); });
addEventListener('keydown', event => {
  if (event.code === 'Space' && !event.target.closest('button, input, a')) {
    event.preventDefault();
    lastMove = performance.now();
    pointerInside = true;
    hasEntered = true;
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

function drawFairy(x, y, scale, time, alpha, tilt = 0) {
  if (!fairySprite.complete || !fairySprite.naturalWidth) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);
  ctx.globalAlpha = alpha;
  glow(0, -25, 145, .25);
  glow(0, -40, 75, .12);
  ctx.drawImage(fairySprite, -105, -115, 210, 210);
  // Keep the existing camera crop aligned with the new character's face.
  if (face && stream && video.readyState >= 2) {
    ctx.save();
    ctx.translate(3, -87);
    ctx.rotate(-.22);
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2); ctx.clip();
    ctx.scale(-1, 1);
    ctx.drawImage(video, face.x, face.y, face.w, face.h, -10, -12, 20, 24);
    ctx.fillStyle = '#a1edb51a'; ctx.fillRect(-10, -12, 20, 24);
    ctx.restore();
  }
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
  const target = pointerInside ? 1 : 0;
  const fadeRate = pointerInside ? 3.8 : 1.5;
  presence += (target - presence) * (1 - Math.exp(-dt * fadeRate));
  const forestTarget = !hasEntered ? .74 : .18 + presence * .82;
  forestLight += (forestTarget - forestLight) * (1 - Math.exp(-dt * 3));
  root.style.setProperty('--presence', presence.toFixed(3));
  root.style.setProperty('--forest-light', forestLight.toFixed(3));
  const state = !hasEntered ? '고요한 숲 · 마우스를 움직여 보세요' : pointerInside ? '당신 곁에 머무는 숲의 요정' : presence > .04 ? '빛이 천천히 어둠으로 스며들어요' : '숲이 당신을 기다리고 있어요';
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
