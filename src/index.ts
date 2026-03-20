#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { startAnnotationServer, waitForAnnotation, getServerPort } from './annotation-server.js';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = import.meta.dirname ?? join(__filename, '..');

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  const child = exec(`${cmd} "${url}"`);
  // Prevent child process output from corrupting MCP stdio transport
  child.stdout?.destroy();
  child.stderr?.destroy();
}

// Read image + metadata, return MCP content array with inline image
async function buildAnnotationResponse(imagePath: string, extra: Record<string, unknown> = {}) {
  const imageData = await readFile(imagePath);
  const base64 = imageData.toString('base64');

  let metadata = {};
  const metaPath = imagePath.replace('.png', '.json');
  try {
    if (existsSync(metaPath)) {
      metadata = JSON.parse(await readFile(metaPath, 'utf-8'));
    }
  } catch {}

  return {
    content: [
      {
        type: 'image' as const,
        data: base64,
        mimeType: 'image/png' as const,
      },
      {
        type: 'text' as const,
        text: `The user has annotated a screenshot with visual feedback. Study the image carefully:
- RED circles/rectangles = elements that need changes
- ARROWS = point to specific areas or show movement
- HIGHLIGHTS = regions of interest
- TEXT labels = direct instructions

Implement every change the annotations indicate. If unclear, describe what you see and ask.

${JSON.stringify({ annotated_image_path: imagePath, metadata, ...extra })}`,
      },
    ],
  };
}

const server = new McpServer({
  name: 'blip',
  version: '0.1.0',
});

// Single tool: annotate a live page or open the standalone editor
server.tool(
  'annotate',
  'Open a visual annotation editor so the user can draw on a live page or screenshot. The user draws circles, arrows, highlights, rectangles, and text to show you exactly what they want changed. Returns a screenshot with their annotations overlaid. Study the annotations carefully: circles and rectangles highlight specific elements, arrows point to areas of interest, highlights mark regions, and text labels contain instructions. Implement ALL visual feedback from the annotations.',
  {
    url: z.string().optional().describe('URL of a live page to annotate (e.g., http://localhost:3000). If omitted, opens the standalone editor where you can paste or drop a screenshot.'),
  },
  async ({ url: targetUrl }) => {
    const port = await startAnnotationServer();

    let browserUrl: string;
    if (targetUrl) {
      // Proxy mode: inject overlay on the live page
      browserUrl = `http://localhost:${port}/proxy?url=${encodeURIComponent(targetUrl)}`;
    } else {
      // Standalone editor mode
      browserUrl = `http://localhost:${port}/annotate`;
    }

    openBrowser(browserUrl);
    const result = await waitForAnnotation();
    return buildAnnotationResponse(result.imagePath, targetUrl ? { source_url: targetUrl } : {});
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Prevent silent crashes -- send clean error to MCP client
process.on('uncaughtException', (err) => {
  process.stderr.write(`[blip] Uncaught exception: ${err.message}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[blip] Unhandled rejection: ${reason}\n`);
});

main().catch(console.error);
