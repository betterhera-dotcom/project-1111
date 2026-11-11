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
const colorInput = document.querySelector('#glow-color');
const colorName = document.querySelector('#color-name');
let lightRgb = [123, 246, 179], lightHighlight = '#dbffe9';
let lightStrength = 1, faceScale = 1;
document.querySelector('#glow-strength').addEventListener('input', event => {
  lightStrength = Number(event.target.value) / 100;
  document.querySelector('#glow-strength-value').textContent = event.target.value + '%';
  event.target.setAttribute('aria-valuetext', event.target.value + '%');
});
document.querySelector('#face-size').addEventListener('input', event => {
  faceScale = Number(event.target.value) / 100;
  document.querySelector('#face-size-value').textContent = event.target.value + '%';
  event.target.setAttribute('aria-valuetext', event.target.value + '%');
  lastFaceVideoTime = -1;
});
function setGlowColor(hex, name) {
  lightRgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  lightHighlight = `rgb(${lightRgb.map(value => Math.round(value * .45 + 255 * .55)).join(',')})`;
  colorInput.value = hex;
  colorName.textContent = name;
  document.querySelectorAll('[data-glow]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.glow === hex)));
}
colorInput.addEventListener('input', () => setGlowColor(colorInput.value, '직접 고른 빛'));
document.querySelectorAll('[data-glow]').forEach(button => button.addEventListener('click', () => setGlowColor(button.dataset.glow, button.getAttribute('aria-label'))));
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
let faceOpacity = 0, lastFaceVideoTime = -1;
const faceTexture = document.createElement('canvas');
faceTexture.width = 160;
faceTexture.height = 200;
const faceCtx = faceTexture.getContext('2d');

function updateFaceTexture() {
  if (!face || !stream || video.readyState < 2 || video.currentTime === lastFaceVideoTime) return;
  lastFaceVideoTime = video.currentTime;
  faceCtx.clearRect(0, 0, 160, 200);
  faceCtx.save();
  // Level and mirror the camera eyes before fitting them into the fairy's face.
  faceCtx.translate(80, 76);
  const zoom = 72 / face.eyeDistance * faceScale;
  faceCtx.scale(-zoom, zoom);
  faceCtx.rotate(-face.angle);
  faceCtx.translate(-face.eyeX, -face.eyeY);
  faceCtx.filter = 'saturate(.88) contrast(.96) brightness(1.04)';
  faceCtx.drawImage(video, 0, 0);
  faceCtx.restore();
  // Feather the edge so the video blends into the painted hair and skin.
  faceCtx.save();
  faceCtx.globalCompositeOperation = 'destination-in';
  faceCtx.translate(80, 103);
  faceCtx.scale(74, 94);
  const mask = faceCtx.createRadialGradient(0, 0, .62, 0, 0, 1);
  mask.addColorStop(0, '#fff');
  mask.addColorStop(.58, '#ffffffed');
  mask.addColorStop(1, '#ffffff00');
  faceCtx.fillStyle = mask;
  faceCtx.fillRect(-2, -2, 4, 4);
  faceCtx.restore();
}

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
  opacity = Math.min(.95, opacity * lightStrength);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const rgb = lightRgb.join(',');
  const bright = lightRgb.map(value => Math.round(value * .55 + 255 * .45)).join(',');
  gradient.addColorStop(0, `rgba(${bright},${opacity})`);
  gradient.addColorStop(.2, `rgba(${rgb},${opacity * .5})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function star(x, y, radius, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= Math.min(1, alpha * lightStrength);
  ctx.fillStyle = lightHighlight;
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
  if (faceOpacity > .005) {
    ctx.save();
    ctx.globalAlpha *= faceOpacity;
    ctx.translate(4, -85.5);
    ctx.rotate(-.22);
    ctx.drawImage(faceTexture, -14, -18, 28, 35);
    ctx.restore();
  }
  ctx.restore();
}
function detectFace(now) {
  if (face && now - faceSeenAt > 450) {
    face = null;
    tracking.textContent = '얼굴을 카메라에 보여 주세요 · 기본 요정 표시';
  }
  if (!detector || !stream || video.readyState < 2 || now - lastDetection < 100 || video.currentTime === lastVideoTime) return;
  lastDetection = now;
  lastVideoTime = video.currentTime;
  try {
    const detections = detector.detectForVideo(video, now).detections;
    const best = detections.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
    if (best) {
      const box = best.boundingBox;
      const eyes = (best.keypoints || []).slice(0, 2).sort((a, b) => a.x - b.x);
      const dx = eyes.length === 2 ? (eyes[1].x - eyes[0].x) * video.videoWidth : box.width * .36;
      const dy = eyes.length === 2 ? (eyes[1].y - eyes[0].y) * video.videoHeight : 0;
      const crop = {
        eyeX: eyes.length === 2 ? (eyes[0].x + eyes[1].x) * video.videoWidth / 2 : box.originX + box.width / 2,
        eyeY: eyes.length === 2 ? (eyes[0].y + eyes[1].y) * video.videoHeight / 2 : box.originY + box.height * .38,
        eyeDistance: Math.max(8, Math.hypot(dx, dy)),
        angle: Math.atan2(dy, dx),
      };
      if (face) for (const key of Object.keys(crop)) face[key] += (crop[key] - face[key]) * .45;
      else face = crop;
      faceSeenAt = now;
      tracking.textContent = '얼굴 인식 중 · 요정에 실시간 적용';
    } else if (now - faceSeenAt > 350) {
      face = null;
      tracking.textContent = '얼굴을 카메라에 보여 주세요 · 기본 요정 표시';
    }
  } catch {
    detector = null;
    face = null;
    tracking.textContent = '기본 요정 얼굴 표시';
    cameraStatus.textContent = '카메라는 연결됐지만 얼굴 인식이 중단됐어요. 스위치를 껐다가 다시 켜 주세요.';
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
  updateFaceTexture();
  faceOpacity += ((face && stream ? 1 : 0) - faceOpacity) * (1 - Math.exp(-dt * 10));
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
      const embedded = document.querySelector('#embedded-vision');
      if (embedded) {
        const assets = JSON.parse(embedded.textContent);
        const bytes = text => {
          const binary = atob(text), value = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) value[i] = binary.charCodeAt(i);
          return value;
        };
        const { FaceDetector, FilesetResolver } = await import('data:text/javascript;base64,' + assets.bundle);
        const files = await FilesetResolver.forVisionTasks('.');
        const variant = files.wasmBinaryPath.includes('nosimd') ? 'nosimd' : 'simd';
        const loaderUrl = URL.createObjectURL(new Blob([bytes(assets[variant + 'Loader'])], { type: 'text/javascript' }));
        const wasmUrl = URL.createObjectURL(new Blob([bytes(assets[variant + 'Wasm'])], { type: 'application/wasm' }));
        try {
          return await FaceDetector.createFromOptions({ wasmLoaderPath: loaderUrl, wasmBinaryPath: wasmUrl }, {
            baseOptions: { modelAssetBuffer: bytes(assets.model), delegate: 'CPU' },
            runningMode: 'VIDEO', minDetectionConfidence: .55,
          });
        } finally {
          URL.revokeObjectURL(loaderUrl);
          URL.revokeObjectURL(wasmUrl);
        }
      }
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
  faceOpacity = 0;
  faceSeenAt = 0;
  faceCtx.clearRect(0, 0, 160, 200);
  lastFaceVideoTime = -1;
  lastVideoTime = -1;
  monitor.hidden = true;
  cameraButton.checked = false;
  cameraButton.setAttribute('aria-checked', 'false');
  cameraButton.setAttribute('aria-label', '웹캠 켜기');
  cameraLabel.textContent = '웹캠 꺼짐';
  cameraStatus.textContent = '카메라가 꺼졌어요. 기본 요정으로 돌아갑니다.';
}

async function cameraDeadline(promise, milliseconds, name) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => { const error = new Error(name); error.name = name; reject(error); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

cameraButton.addEventListener('click', async () => {
  if (stream || cameraStarting) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !isSecureContext || (location.protocol === 'file:' && !document.querySelector('#embedded-vision'))) {
    cameraButton.checked = false;
    cameraStatus.textContent = '웹캠은 localhost 또는 HTTPS 주소에서 사용할 수 있어요.';
    return;
  }
  const session = ++cameraSession;
  cameraStarting = true;
  cameraButton.checked = true;
  cameraButton.setAttribute('aria-checked', 'true');
  cameraButton.setAttribute('aria-label', '웹캠 끄기');
  cameraLabel.textContent = '준비 중 · 스위치를 끄면 취소';
  cameraStatus.textContent = '카메라 권한을 허용해 주세요. 다른 창의 웹캠은 먼저 꺼 주세요.';
  let phase = 'device';
  try {
    // Use the camera's default supported format, including USB cameras on Windows.
    const request = navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(acquired => {
      if (session !== cameraSession) { acquired.getTracks().forEach(track => track.stop()); return null; }
      return acquired;
    });
    const acquired = await cameraDeadline(request, 20000, 'CameraStartTimeout');
    if (!acquired || session !== cameraSession) return;
    stream = acquired;
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (session === cameraSession) stopCamera(); });
    phase = 'video';
    monitor.hidden = false;
    cameraLabel.textContent = '카메라 연결됨 · 영상 시작 중';
    tracking.textContent = '카메라 영상 연결 중';
    cameraStatus.textContent = '카메라가 연결됐어요. 영상을 시작하고 있어요.';
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await cameraDeadline(video.play(), 10000, 'VideoStartTimeout');
    if (session !== cameraSession) return;
    cameraLabel.textContent = '웹캠 켜짐 · 얼굴 인식 준비 중';
    tracking.textContent = '얼굴 인식 준비 중';
    cameraStatus.textContent = '얼굴을 자동으로 찾고 있어요. 잠시만 기다려 주세요.';
    try {
      detector = await cameraDeadline(loadDetector(), 20000, 'DetectorStartTimeout');
    } catch {
      if (session !== cameraSession) return;
      detector = null;
      face = null;
      cameraStarting = false;
      cameraLabel.textContent = '웹캠 켜짐 · 기본 얼굴 표시';
      tracking.textContent = '얼굴 인식을 준비하지 못했어요';
      cameraStatus.textContent = '카메라 영상은 연결됐어요. 얼굴 인식을 다시 시작하려면 스위치를 껐다가 켜 주세요.';
      return;
    }
    if (session !== cameraSession) return;
    cameraStarting = false;
    monitor.hidden = false;
    cameraLabel.textContent = '웹캠 켜짐';
    tracking.textContent = '얼굴을 찾고 있어요';
    cameraStatus.textContent = '자동으로 얼굴을 찾아 요정에 비춰요. 영상은 저장되지 않아요.';
    lastMove = performance.now();
  } catch (error) {
    if (session !== cameraSession) return;
    stopCamera();
    cameraStatus.textContent = phase === 'video' ? '권한은 허용됐지만 카메라 영상이 시작되지 않았어요. 다른 창의 웹캠을 끈 뒤 다시 켜 주세요.'
      : error.name === 'CameraStartTimeout' ? '카메라 연결이 응답하지 않아요. 다른 창의 웹캠을 끄고 권한 창에서 허용한 뒤 다시 켜 주세요.'
      : error.name === 'NotAllowedError' || error.name === 'SecurityError' ? '카메라 권한이 꺼져 있어요. 주소 옆 카메라 표시에서 허용 후 다시 켜 주세요.'
      : error.name === 'NotFoundError' ? '연결된 카메라를 찾지 못했어요. USB 연결을 확인해 주세요.'
      : error.name === 'NotReadableError' || error.name === 'AbortError' ? '카메라를 열지 못했어요. 다른 창이나 앱의 웹캠을 먼저 끈 뒤 다시 켜 주세요.'
      : '카메라를 시작하지 못했어요. 다른 창의 웹캠과 USB 연결을 확인한 뒤 다시 켜 주세요.';
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
