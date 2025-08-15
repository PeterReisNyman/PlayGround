const video = document.getElementById('video');
const canvas = document.getElementById('display');
const ctx = canvas.getContext('2d');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const presetSel = document.getElementById('preset');
const colsRange = document.getElementById('cols');
const colsVal = document.getElementById('colsVal');
const trailsRange = document.getElementById('trails');
const trailsVal = document.getElementById('trailsVal');
const invertChk = document.getElementById('invert');
const btnRec = document.getElementById('btnRec');
const btnStopRec = document.getElementById('btnStopRec');
const download = document.getElementById('download');

let stream = null;
let raf = 0;
let worker = null; // simple inline conversion, no Worker for now
let recorder = null;
let recChunks = [];

const PRESETS = {
  classic: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  dense: " .:-=+*#%@",
  blocks: " ░▒▓█",
};

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(240, Math.floor(rect.height * dpr));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  video.srcObject = stream;
  await video.play();
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnRec.disabled = false;
  loop();
}

function stopCamera() {
  if (raf) cancelAnimationFrame(raf);
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
  btnStart.disabled = false;
  btnStop.disabled = true;
  btnRec.disabled = true;
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toASCII(imageData, cols, preset, invert=false, trails=0) {
  const glyphs = PRESETS[preset] || PRESETS.classic;
  const w = imageData.width, h = imageData.height, data = imageData.data;
  // map to cell size roughly based on columns
  const cellW = Math.max(1, Math.floor(w / cols));
  const cellH = Math.floor(cellW * 2); // aspect compensator
  const rows = Math.max(1, Math.floor(h / cellH));

  // Trails: draw semi-transparent rect to accumulate
  if (trails > 0) {
    ctx.globalAlpha = trails;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const stepX = w / cols;
  const stepY = h / rows;
  const fontSize = Math.max(6, Math.floor(canvas.width / cols));
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e5e7eb';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = Math.floor(col * stepX);
      const sy = Math.floor(row * stepY);
      const ex = Math.floor((col + 1) * stepX);
      const ey = Math.floor((row + 1) * stepY);
      let sum = 0, count = 0;
      for (let y = sy; y < ey; y += 2) { // stride for speed
        const off = y * w * 4;
        for (let x = sx; x < ex; x += 2) {
          const i = off + x * 4;
          sum += luminance(data[i], data[i+1], data[i+2]);
          count++;
        }
      }
      const lum = count ? sum / count : 0;
      let t = lum / 255;
      if (invert) t = 1 - t;
      const idx = Math.max(0, Math.min(glyphs.length - 1, Math.floor(t * (glyphs.length - 1))));
      const ch = glyphs[idx];
      const dx = Math.floor((col * canvas.width) / cols);
      const dy = Math.floor((row * canvas.height) / rows);
      ctx.fillText(ch, dx, dy);
    }
  }
}

function loop() {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const off = new OffscreenCanvas(vw, vh);
  const octx = off.getContext('2d');
  const run = () => {
    octx.drawImage(video, 0, 0, vw, vh);
    const frame = octx.getImageData(0, 0, vw, vh);
    const cols = parseInt(colsRange.value, 10);
    toASCII(frame, cols, presetSel.value, invertChk.checked, parseFloat(trailsRange.value));
    raf = requestAnimationFrame(run);
  };
  run();
}

btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);
colsRange.addEventListener('input', () => colsVal.textContent = colsRange.value);
trailsRange.addEventListener('input', () => trailsVal.textContent = trailsRange.value);

// Recording
btnRec.addEventListener('click', () => {
  if (recorder) return;
  const fps = 30;
  const cs = canvas.captureStream(fps);
  recorder = new MediaRecorder(cs, { mimeType: 'video/webm;codecs=vp9' });
  recChunks = [];
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    download.href = url;
    download.hidden = false;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  recorder.start();
  btnRec.disabled = true;
  btnStopRec.disabled = false;
});

btnStopRec.addEventListener('click', () => {
  if (!recorder) return;
  recorder.stop();
  recorder = null;
  btnRec.disabled = false;
  btnStopRec.disabled = true;
});

