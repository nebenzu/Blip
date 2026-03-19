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
        text: JSON.stringify({
          annotated_image_path: imagePath,
          metadata,
          ...extra,
        }),
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
  'Open a visual annotation editor. The user can draw circles, arrows, highlights, and text on a screenshot. Returns the annotated image directly.',
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

main().catch(console.error);
