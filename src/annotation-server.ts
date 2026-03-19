import express from 'express';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const SCREENSHOTS_DIR = join(PROJECT_ROOT, 'screenshots');
const LANDING_DIR = join(PROJECT_ROOT, 'landing');

export interface AnnotationResult {
  imagePath: string;
}

type ResolveCallback = (result: AnnotationResult) => void;

let pendingResolve: ResolveCallback | null = null;
let server: Server | null = null;
let serverPort = 0;

export async function startAnnotationServer(port = 4461): Promise<number> {
  if (server) return serverPort;

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const app = express();

  // Serve landing page at root
  app.get('/', (_req, res) => {
    const landingIndex = join(LANDING_DIR, 'index.html');
    if (existsSync(landingIndex)) {
      res.sendFile(landingIndex);
    } else {
      res.redirect('/annotate');
    }
  });

  // Serve landing page static files
  app.use('/landing', express.static(LANDING_DIR));

  // Proxy route: fetch any URL and inject the overlay script
  app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send('Missing ?url= parameter');
      return;
    }

    try {
      const response = await fetch(targetUrl);
      let html = await response.text();
      const contentType = response.headers.get('content-type') || 'text/html';

      if (contentType.includes('text/html')) {
        // Inject overlay script before </body>
        const overlayScript = `<script src="/overlay.js?v=${Date.now()}"></script>`;
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${overlayScript}\n</body>`);
        } else {
          html += overlayScript;
        }

        // Rewrite relative URLs to point back to the target origin
        const url = new URL(targetUrl);
        const base = `<base href="${url.origin}/">`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>\n${base}`);
        } else if (html.includes('<html')) {
          html = html.replace(/<html[^>]*>/, `$&\n<head>${base}</head>`);
        }
      }

      res.type('text/html').send(html);
    } catch (err) {
      res.status(500).send(`Failed to fetch ${targetUrl}`);
    }
  });

  // Annotation app at /annotate
  app.get('/annotate', (_req, res) => {
    res.sendFile(join(PUBLIC_DIR, 'index.html'));
  });

  // Static files for annotation app
  app.use(express.static(PUBLIC_DIR, { etag: false, lastModified: false, maxAge: 0 }));

  // Serve an image by path (restricted to screenshots directory)
  app.get('/api/image', (req, res) => {
    const imgPath = req.query.path as string;
    if (!imgPath) return res.status(400).json({ error: 'No path provided' });
    const resolved = resolve(imgPath);
    if (!resolved.startsWith(SCREENSHOTS_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!existsSync(resolved)) return res.status(404).json({ error: 'Image not found' });
    res.sendFile(resolved);
  });

  // Save annotated image
  app.post('/api/save', async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve) => req.on('end', resolve));
      const body = Buffer.concat(chunks);

      const boundary = req.headers['content-type']?.split('boundary=')[1];
      let imageBuffer: Buffer;

      if (boundary) {
        const bodyStr = body.toString('latin1');
        const parts = bodyStr.split('--' + boundary);
        const imagePart = parts.find(p => p.includes('filename='));
        if (!imagePart) {
          res.status(400).json({ error: 'No image in request' });
          return;
        }
        const headerEnd = imagePart.indexOf('\r\n\r\n');
        const dataStart = headerEnd + 4;
        const dataEnd = imagePart.lastIndexOf('\r\n');
        imageBuffer = Buffer.from(imagePart.slice(dataStart, dataEnd), 'latin1');
      } else {
        imageBuffer = body;
      }

      const filename = `annotated-${Date.now()}.png`;
      const filepath = join(SCREENSHOTS_DIR, filename);
      await writeFile(filepath, imageBuffer);

      if (pendingResolve) {
        pendingResolve({ imagePath: filepath });
        pendingResolve = null;
      }

      res.json({ success: true, path: filepath });
    } catch (err) {
      // Save error
      res.status(500).json({ error: 'Failed to save' });
    }
  });

  // Save annotated image from base64 JSON
  app.post('/api/save-base64', express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const { image, ...metadata } = req.body;
      if (!image) {
        res.status(400).json({ error: 'No image data' });
        return;
      }

      const imageBuffer = Buffer.from(image, 'base64');
      const filename = `annotated-${Date.now()}.png`;
      const filepath = join(SCREENSHOTS_DIR, filename);
      await writeFile(filepath, imageBuffer);

      // Write all metadata alongside
      const metaPath = filepath.replace('.png', '.json');
      await writeFile(metaPath, JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString()
      }, null, 2));

      // Copy image to clipboard on macOS so user can Cmd+V in chat
      if (process.platform === 'darwin') {
        const safePath = filepath.replace(/'/g, "'\\''");
        exec(`osascript -e 'set the clipboard to (read (POSIX file "${safePath}") as «class PNGf»)'`, (err) => {
          if (err) console.error('Clipboard copy failed:', err);
        });
      }

      if (pendingResolve) {
        pendingResolve({ imagePath: filepath });
        pendingResolve = null;
      }

      res.json({ success: true, path: filepath });
    } catch (err) {
      // Save error
      res.status(500).json({ error: 'Failed to save' });
    }
  });

  return new Promise((resolve) => {
    server = createServer(app);
    server.listen(port, () => {
      serverPort = port;
      resolve(port);
    });
    server.on('error', () => {
      server = createServer(app);
      server.listen(0, () => {
        const addr = server!.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve(serverPort);
      });
    });
  });
}

export function waitForAnnotation(): Promise<AnnotationResult> {
  return new Promise((resolve) => {
    pendingResolve = resolve;
  });
}

export function getServerPort(): number {
  return serverPort;
}

export function stopAnnotationServer(): void {
  if (server) {
    server.close();
    server = null;
    serverPort = 0;
  }
}
