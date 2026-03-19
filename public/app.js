// Blip - Annotation Canvas App
const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

let tool = 'pen';
let color = '#ff3333';
let lineWidth = 3;
let isDrawing = false;
let startX, startY;
let history = [];
let historyIndex = -1;
let currentPath = [];
let backgroundImage = null;

// --- Image Loading ---

function loadImage(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    backgroundImage = img;
    resizeToImage(img);
    drawBackground();
    saveState();
  };
  img.src = src;
}

function resizeToImage(img) {
  const maxW = window.innerWidth - 80;
  const maxH = window.innerHeight - 120;
  let w = img.width;
  let h = img.height;
  const ratio = Math.min(maxW / w, maxH / h, 1);
  w = Math.round(w * ratio);
  h = Math.round(h * ratio);
  canvas.width = w;
  canvas.height = h;
  bgCanvas.width = w;
  bgCanvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

function drawBackground() {
  if (!backgroundImage) return;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgCtx.drawImage(backgroundImage, 0, 0, bgCanvas.width, bgCanvas.height);
}

// --- State Management (undo/redo) ---

function saveState() {
  historyIndex++;
  history = history.slice(0, historyIndex);
  history.push(canvas.toDataURL());
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreState();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restoreState();
}

function restoreState() {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = history[historyIndex];
}

function clearAnnotations() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveState();
}

// --- Drawing ---

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e);
  startX = pos.x;
  startY = pos.y;
  currentPath = [pos];

  if (tool === 'pen') {
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  if (tool === 'text') {
    isDrawing = false;
    const text = prompt('Enter text:');
    if (text) {
      ctx.font = `${Math.max(16, lineWidth * 6)}px sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(text, pos.x, pos.y);
      saveState();
    }
  }
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);

  if (tool === 'pen') {
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  } else {
    // For shape tools, redraw from last state
    if (history[historyIndex]) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        drawShape(pos);
      };
      img.src = history[historyIndex];
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawShape(pos);
    }
  }
}

function drawShape(pos) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'arrow') {
    drawArrow(startX, startY, pos.x, pos.y);
  } else if (tool === 'circle') {
    const rx = Math.abs(pos.x - startX) / 2;
    const ry = Math.abs(pos.y - startY) / 2;
    const cx = (startX + pos.x) / 2;
    const cy = (startY + pos.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (tool === 'rect') {
    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
  } else if (tool === 'highlight') {
    ctx.fillStyle = color + '40';
    ctx.fillRect(startX, startY, pos.x - startX, pos.y - startY);
  }
}

function drawArrow(fromX, fromY, toX, toY) {
  const headLen = Math.max(15, lineWidth * 4);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function endDraw(e) {
  if (!isDrawing) return;
  isDrawing = false;
  saveState();
}

// --- Event Listeners ---

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', endDraw);

// --- Toolbar ---

document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tool = btn.dataset.tool;
  });
});

document.querySelectorAll('[data-color]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    color = btn.dataset.color;
  });
});

document.querySelectorAll('[data-size]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    lineWidth = parseInt(btn.dataset.size);
  });
});

document.getElementById('undoBtn')?.addEventListener('click', undo);
document.getElementById('redoBtn')?.addEventListener('click', redo);
document.getElementById('clearBtn')?.addEventListener('click', clearAnnotations);

document.getElementById('sendBtn')?.addEventListener('click', async () => {
  // Merge background + annotations into one image
  const merged = document.createElement('canvas');
  merged.width = canvas.width;
  merged.height = canvas.height;
  const mCtx = merged.getContext('2d');
  mCtx.drawImage(bgCanvas, 0, 0);
  mCtx.drawImage(canvas, 0, 0);

  const blob = await new Promise(resolve => merged.toBlob(resolve, 'image/png'));
  const formData = new FormData();
  formData.append('image', blob, 'annotated.png');

  try {
    const res = await fetch('/api/save', { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('status').textContent = 'Sent to Claude!';
    document.getElementById('status').classList.add('success');
    setTimeout(() => {
      document.getElementById('status').textContent = '';
      document.getElementById('status').classList.remove('success');
    }, 3000);
  } catch (err) {
    document.getElementById('status').textContent = 'Error saving annotation.';
  }
});

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
});

// --- Drag & Drop / Paste ---

canvas.addEventListener('dragover', e => { e.preventDefault(); });
canvas.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImage(URL.createObjectURL(file));
  }
});

document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) loadImage(URL.createObjectURL(blob));
    }
  }
});

// --- Init ---

const params = new URLSearchParams(window.location.search);
const imagePath = params.get('image');
if (imagePath) {
  loadImage('/api/image?path=' + encodeURIComponent(imagePath));
} else {
  // Default: set a blank canvas
  canvas.width = 800;
  canvas.height = 600;
  bgCanvas.width = 800;
  bgCanvas.height = 600;
  bgCtx.fillStyle = '#1a1a2e';
  bgCtx.fillRect(0, 0, 800, 600);
  bgCtx.fillStyle = '#444';
  bgCtx.font = '20px sans-serif';
  bgCtx.textAlign = 'center';
  bgCtx.fillText('Paste or drop a screenshot here', 400, 300);
  saveState();
}
