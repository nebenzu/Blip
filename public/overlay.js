// Blip - Injectable annotation overlay
// Add this script to ANY page to enable drawing annotations on top of it.
// Canvas covers the FULL document so you can scroll and annotate anywhere.

(function () {
  // Capture origin immediately -- document.currentScript is only available during
  // synchronous execution and will be null after React hydration replaces the DOM.
  const _dicScript = document.currentScript;
  const _dicOrigin = _dicScript ? new URL(_dicScript.src).origin : '';

  function init() {
    // Guard: check if overlay DOM already exists (not a JS flag, which survives hydration)
    if (document.getElementById('dic-overlay')) return;

  let active = false;
  let tool = 'pen';
  let color = '#ff3333';
  let lineWidth = 3;
  let isDrawing = false;
  let startX, startY;

  // Store annotations as objects with document-level coordinates
  let strokes = [];
  let redoStack = [];

  // --- Create overlay elements ---

  const overlay = document.createElement('div');
  overlay.id = 'dic-overlay';
  overlay.innerHTML = `
    <canvas id="dic-canvas"></canvas>
    <div id="dic-toolbar">
      <div class="dic-group">
        <button class="dic-btn dic-active" data-tool="pen">Pen</button>
        <button class="dic-btn" data-tool="arrow">Arrow</button>
        <button class="dic-btn" data-tool="circle">Circle</button>
        <button class="dic-btn" data-tool="rect">Rect</button>
        <button class="dic-btn" data-tool="highlight">Highlight</button>
        <button class="dic-btn" data-tool="text">Text</button>
      </div>
      <div class="dic-sep"></div>
      <div class="dic-group">
        <button class="dic-color dic-active" data-color="#ff3333" style="background:#ff3333"></button>
        <button class="dic-color" data-color="#33aaff" style="background:#33aaff"></button>
        <button class="dic-color" data-color="#33ff88" style="background:#33ff88"></button>
        <button class="dic-color" data-color="#ffdd33" style="background:#ffdd33"></button>
        <button class="dic-color" data-color="#ffffff" style="background:#ffffff"></button>
      </div>
      <div class="dic-sep"></div>
      <div class="dic-group">
        <button class="dic-btn dic-size" data-size="2"><span style="width:4px;height:4px"></span></button>
        <button class="dic-btn dic-size dic-active" data-size="4"><span style="width:8px;height:8px"></span></button>
        <button class="dic-btn dic-size" data-size="8"><span style="width:12px;height:12px"></span></button>
      </div>
      <div class="dic-sep"></div>
      <div class="dic-group">
        <button class="dic-btn" id="dic-undo">Undo</button>
        <button class="dic-btn" id="dic-redo">Redo</button>
        <button class="dic-btn" id="dic-clear">Clear</button>
      </div>
      <button class="dic-btn dic-send" id="dic-send">Send to Claude</button>
      <button class="dic-btn dic-cancel" id="dic-cancel">Cancel</button>
      <span id="dic-status"></span>
    </div>
    <input id="dic-text-input" type="text" placeholder="Type and press Enter..." />
  `;

  const style = document.createElement('style');
  style.textContent = `
    #dic-overlay {
      display: none;
    }
    #dic-overlay.active {
      display: block;
    }
    #dic-canvas {
      position: absolute;
      top: 0;
      left: 0;
      cursor: crosshair;
      z-index: 999998;
      pointer-events: auto;
    }
    #dic-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(15, 15, 25, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 2px solid #7c5cbf;
      z-index: 1000000;
      flex-wrap: wrap;
      pointer-events: auto;
    }
    .dic-group { display: flex; align-items: center; gap: 4px; }
    .dic-sep { width: 1px; height: 24px; background: #444; margin: 0 4px; }
    .dic-btn {
      background: #1e1e38;
      border: 1px solid #333;
      color: #ccc;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .dic-btn:hover { background: #2a2a50; border-color: #555; }
    .dic-btn.dic-active { background: #3a2a6a; border-color: #7c5cbf; color: #fff; }
    .dic-color {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 2px solid #333;
      cursor: pointer;
      padding: 0;
    }
    .dic-color.dic-active { border-color: #fff; box-shadow: 0 0 6px rgba(255,255,255,0.3); }
    .dic-send {
      background: #7c5cbf !important;
      border-color: #9b7dd4 !important;
      color: #fff !important;
      font-weight: 600 !important;
      margin-left: auto !important;
      padding: 6px 16px !important;
    }
    .dic-send:hover { background: #9b7dd4 !important; }
    .dic-cancel {
      background: #333 !important;
      color: #aaa !important;
    }
    .dic-size { width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; }
    .dic-size span { display: block; border-radius: 50%; background: currentColor; }
    #dic-status { font-size: 12px; color: #4ade80; margin-left: 8px; }
    #dic-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #7c5cbf;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      z-index: 999997;
      box-shadow: 0 4px 20px rgba(124, 92, 191, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      font-family: -apple-system, system-ui, sans-serif;
    }
    #dic-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 30px rgba(124, 92, 191, 0.7);
    }
    #dic-fab.hidden { display: none; }
    #dic-text-input {
      display: none;
      position: fixed;
      z-index: 1000001;
      background: rgba(0,0,0,0.85);
      color: #fff;
      border: 2px solid #7c5cbf;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 16px;
      font-family: -apple-system, system-ui, sans-serif;
      outline: none;
      min-width: 150px;
      pointer-events: auto;
    }
  `;

  const fab = document.createElement('button');
  fab.id = 'dic-fab';
  fab.title = 'Annotate this page';
  fab.textContent = '\u270F\uFE0F';

  document.head.appendChild(style);
  document.body.appendChild(overlay);
  document.body.appendChild(fab);

  const canvas = document.getElementById('dic-canvas');
  const ctx = canvas.getContext('2d');
  const textInput = document.getElementById('dic-text-input');

  // Get full document dimensions
  function getDocSize() {
    return {
      w: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
      h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)
    };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio;
    const doc = getDocSize();
    canvas.style.width = doc.w + 'px';
    canvas.style.height = doc.h + 'px';
    canvas.width = doc.w * dpr;
    canvas.height = doc.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }

  function activate() {
    active = true;
    overlay.classList.add('active');
    fab.classList.add('hidden');
    resizeCanvas();
  }

  function deactivate() {
    active = false;
    overlay.classList.remove('active');
    fab.classList.remove('hidden');
    strokes = [];
    redoStack = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  fab.addEventListener('click', activate);
  document.getElementById('dic-cancel').addEventListener('click', deactivate);

  // --- Redraw all strokes ---
  // Strokes are in document coordinates, canvas is also document-sized,
  // so no offset needed for drawing -- they map 1:1.

  function redrawAll() {
    const doc = getDocSize();
    ctx.clearRect(0, 0, doc.w, doc.h);
    for (const s of strokes) {
      drawStrokeOn(ctx, s, 0, 0);
    }
  }

  // --- Undo / Redo / Clear ---

  function undo() {
    if (strokes.length === 0) return;
    redoStack.push(strokes.pop());
    redrawAll();
  }

  function redo() {
    if (redoStack.length === 0) return;
    strokes.push(redoStack.pop());
    redrawAll();
  }

  document.getElementById('dic-undo').addEventListener('click', undo);
  document.getElementById('dic-redo').addEventListener('click', redo);
  document.getElementById('dic-clear').addEventListener('click', () => {
    strokes = [];
    redoStack = [];
    redrawAll();
  });

  // --- Drawing ---

  // Mouse/touch position to document coordinates
  function toDoc(e) {
    return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
  }

  let currentStroke = null;

  canvas.addEventListener('mousedown', (e) => {
    if (!active) return;
    const doc = toDoc(e);

    if (tool === 'text') {
      textInput.style.display = 'block';
      textInput.style.left = e.clientX + 'px';
      textInput.style.top = e.clientY + 'px';
      textInput.style.color = color;
      textInput.value = '';
      textInput.dataset.docX = doc.x;
      textInput.dataset.docY = doc.y;
      textInput.focus();
      return;
    }

    isDrawing = true;
    startX = doc.x;
    startY = doc.y;

    if (tool === 'pen') {
      currentStroke = { type: 'pen', color, lineWidth, points: [{ x: doc.x, y: doc.y }] };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !active) return;
    const doc = toDoc(e);

    if (tool === 'pen' && currentStroke) {
      currentStroke.points.push({ x: doc.x, y: doc.y });
      redrawAll();
      drawStrokeOn(ctx, currentStroke, 0, 0);
    } else {
      const preview = makeShape(doc);
      if (preview) {
        redrawAll();
        drawStrokeOn(ctx, preview, 0, 0);
      }
    }
  });

  function makeShape(doc) {
    if (tool === 'arrow') return { type: 'arrow', color, lineWidth, x1: startX, y1: startY, x2: doc.x, y2: doc.y };
    if (tool === 'circle') return { type: 'circle', color, lineWidth, x1: startX, y1: startY, x2: doc.x, y2: doc.y };
    if (tool === 'rect') return { type: 'rect', color, lineWidth, x1: startX, y1: startY, x2: doc.x, y2: doc.y };
    if (tool === 'highlight') return { type: 'highlight', color, lineWidth, x1: startX, y1: startY, x2: doc.x, y2: doc.y };
    return null;
  }

  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const doc = toDoc(e);

    if (tool === 'pen' && currentStroke) {
      strokes.push(currentStroke);
      currentStroke = null;
    } else {
      const shape = makeShape(doc);
      if (shape) strokes.push(shape);
    }
    redoStack = [];
    redrawAll();
  });

  canvas.addEventListener('mouseleave', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const doc = toDoc(e);
    if (tool === 'pen' && currentStroke) {
      strokes.push(currentStroke);
      currentStroke = null;
    } else {
      const shape = makeShape(doc);
      if (shape) strokes.push(shape);
    }
    redoStack = [];
    redrawAll();
  });

  // --- Text input handler ---

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = textInput.value.trim();
      if (text) {
        strokes.push({
          type: 'text', color, lineWidth,
          x: parseFloat(textInput.dataset.docX),
          y: parseFloat(textInput.dataset.docY),
          text
        });
        redoStack = [];
        redrawAll();
      }
      textInput.style.display = 'none';
    }
    if (e.key === 'Escape') {
      textInput.style.display = 'none';
    }
    e.stopPropagation();
  });

  // --- Toolbar ---

  overlay.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('dic-active'));
      btn.classList.add('dic-active');
      tool = btn.dataset.tool;
    });
  });

  overlay.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-color]').forEach(b => b.classList.remove('dic-active'));
      btn.classList.add('dic-active');
      color = btn.dataset.color;
    });
  });

  overlay.querySelectorAll('[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-size]').forEach(b => b.classList.remove('dic-active'));
      btn.classList.add('dic-active');
      lineWidth = parseInt(btn.dataset.size);
    });
  });

  // --- Send: capture full page screenshot + overlay annotations ---

  // Load html2canvas for page capture
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) return resolve(window.html2canvas);
      const script = document.createElement('script');
      script.src = _dicOrigin + '/html2canvas.min.js';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => reject(new Error('Failed to load html2canvas'));
      document.head.appendChild(script);
    });
  }

  // Fix vh units before html2canvas capture to prevent stretching.
  // html2canvas recalculates 100vh relative to the full document height,
  // which causes elements like .hero { min-height: 100vh } to stretch.
  function freezeVhUnits() {
    const viewportH = window.innerHeight;
    const style = document.createElement('style');
    style.id = 'dic-vh-fix';
    style.textContent = `*, *::before, *::after { --dic-real-vh: ${viewportH}px !important; }`;
    // Replace all vh usages in computed styles by setting explicit pixel heights
    const vhElements = [];
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      // Check inline/stylesheet for vh usage
      const raw = el.getAttribute('style') || '';
      const sheets = [...document.styleSheets];
      let usesVh = raw.includes('vh');
      if (!usesVh) {
        // Check if min-height or height is viewport-relative by comparing to viewport
        const mh = parseFloat(cs.minHeight);
        const h = parseFloat(cs.height);
        if (mh === viewportH || Math.abs(mh - viewportH) < 2) usesVh = true;
        if (h === viewportH || Math.abs(h - viewportH) < 2) usesVh = true;
      }
      if (usesVh) {
        vhElements.push({
          el,
          origMinHeight: el.style.minHeight,
          origHeight: el.style.height,
        });
        if (parseFloat(cs.minHeight) >= viewportH - 2) {
          el.style.minHeight = viewportH + 'px';
        }
        if (parseFloat(cs.height) >= viewportH - 2 && cs.height !== 'auto') {
          el.style.height = viewportH + 'px';
        }
      }
    });
    return function restore() {
      vhElements.forEach(({ el, origMinHeight, origHeight }) => {
        el.style.minHeight = origMinHeight;
        el.style.height = origHeight;
      });
    };
  }

  document.getElementById('dic-send').addEventListener('click', async () => {
    const status = document.getElementById('dic-status');
    status.textContent = 'Capturing page...';

    // Use CSS pixel dimensions for html2canvas (it works in CSS pixels)
    const cssW = document.documentElement.scrollWidth;
    const cssH = document.documentElement.scrollHeight;

    try {
      // Step 1: Hide overlay UI so it doesn't appear in the screenshot
      overlay.style.display = 'none';
      canvas.style.display = 'none';

      // Step 2: Freeze vh units to prevent stretching, then capture
      const restoreVh = freezeVhUnits();
      let pageBg;
      try {
        const h2c = await loadHtml2Canvas();
        pageBg = await h2c(document.documentElement, {
          width: cssW,
          height: cssH,
          windowWidth: cssW,
          windowHeight: window.innerHeight,
          scrollX: 0,
          scrollY: 0,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
      } finally {
        restoreVh();
        overlay.style.display = '';
        canvas.style.display = '';
      }

      status.textContent = 'Compositing annotations...';

      // Step 3: Composite page background + annotations in CSS pixels
      const comp = document.createElement('canvas');
      comp.width = cssW;
      comp.height = cssH;
      const compCtx = comp.getContext('2d');

      // Draw page background first
      compCtx.drawImage(pageBg, 0, 0);

      // Draw annotations on top (strokes are in CSS coords)
      for (const s of strokes) {
        drawStrokeOn(compCtx, s, 0, 0);
      }

      const dataUrl = comp.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      // Also serialize stroke data so Claude can understand what was annotated
      const strokeData = strokes.map(s => {
        const base = { type: s.type, color: s.color };
        if (s.type === 'pen') return { ...base, bounds: getPenBounds(s.points) };
        if (s.type === 'text') return { ...base, x: s.x, y: s.y, text: s.text };
        return { ...base, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 };
      });

      const res = await fetch(_dicOrigin + '/api/save-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          page: window.location.pathname,
          scrollY: window.scrollY,
          documentSize: { width: cssW, height: cssH },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          strokeCount: strokes.length,
          strokes: strokeData
        })
      });
      const data = await res.json();
      if (data.success) {
        status.textContent = '\u2705 Image copied! Cmd+V in Claude to attach.';
        status.style.color = '#4ade80';
        setTimeout(() => { status.textContent = ''; deactivate(); }, 5000);
      } else {
        status.textContent = 'Error: ' + (data.error || 'unknown');
        status.style.color = '#ff4444';
      }
    } catch (err) {
      status.textContent = 'Error: ' + (err.message || 'capture failed');
      status.style.color = '#ff4444';
    }
  });

  function getPenBounds(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  }

  // --- Draw a stroke on any canvas context ---

  function drawStrokeOn(c, s, ox, oy) {
    c.save();
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineWidth = s.lineWidth;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    switch (s.type) {
      case 'pen': {
        if (s.points.length < 2) break;
        c.beginPath();
        c.moveTo(s.points[0].x + ox, s.points[0].y + oy);
        for (let i = 1; i < s.points.length; i++) {
          c.lineTo(s.points[i].x + ox, s.points[i].y + oy);
        }
        c.stroke();
        break;
      }
      case 'arrow': {
        const x1 = s.x1 + ox, y1 = s.y1 + oy, x2 = s.x2 + ox, y2 = s.y2 + oy;
        const headLen = Math.max(15, s.lineWidth * 4);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        c.stroke();
        break;
      }
      case 'circle': {
        const cx = (s.x1 + s.x2) / 2 + ox, cy = (s.y1 + s.y2) / 2 + oy;
        const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
        if (rx > 0 && ry > 0) { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
        break;
      }
      case 'rect': {
        c.strokeRect(s.x1 + ox, s.y1 + oy, s.x2 - s.x1, s.y2 - s.y1);
        break;
      }
      case 'highlight': {
        c.fillStyle = s.color + '40';
        c.fillRect(s.x1 + ox, s.y1 + oy, s.x2 - s.x1, s.y2 - s.y1);
        break;
      }
      case 'text': {
        c.font = `${Math.max(16, s.lineWidth * 6)}px -apple-system, system-ui, sans-serif`;
        c.fillText(s.text, s.x + ox, s.y + oy);
        break;
      }
    }
    c.restore();
  }

  // --- Keyboard ---

  document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (textInput.style.display !== 'none') return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    if (e.key === 'Escape') deactivate();
  });

  // Resize canvas if page content changes size
  const resizeObserver = new ResizeObserver(() => {
    if (active) resizeCanvas();
  });
  resizeObserver.observe(document.body);

  window.addEventListener('resize', () => {
    if (active) resizeCanvas();
  });

  } // end init()

  // Delay injection so React/Next.js hydration can finish first.
  // Try after a short delay, then watch for removal and re-inject.
  function tryInit() {
    if (document.getElementById('dic-overlay')) return;
    if (document.body) {
      init();
    }
  }

  // First attempt: wait for hydration to settle
  if (document.readyState === 'complete') {
    setTimeout(tryInit, 500);
  } else {
    window.addEventListener('load', () => setTimeout(tryInit, 500));
  }

  // Safety net: if React hydration removes our elements, re-inject
  const _blipObserver = new MutationObserver(() => {
    if (!document.getElementById('dic-overlay') && document.body) {
      init();
    }
  });
  if (document.body) {
    _blipObserver.observe(document.body, { childList: true, subtree: false });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      _blipObserver.observe(document.body, { childList: true, subtree: false });
    });
  }
})();
