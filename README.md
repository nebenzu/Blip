# Blip

Visual annotation MCP server for Claude Code. Draw directly on live web pages to tell Claude what to change. Circles, arrows, highlights, text labels -- visual feedback that eliminates ambiguity.

Stop describing UI changes with words. Start drawing on them.

## How it works

1. **Preview your UI** -- Claude opens a live preview of your app
2. **Draw on it** -- Circle a button, arrow to a section, add a text label
3. **Claude acts on it** -- The annotated screenshot goes back to Claude with full context

The annotation overlay injects drawing tools (pen, arrow, circle, rectangle, highlight, text) onto any web page. When you click "Send to Claude", it captures a full-page screenshot with your annotations composited on top and sends it back to your Claude Code session.

## Setup

### 1. Install

```bash
git clone https://github.com/nebenzu/Blip.git
cd Blip
npm install
npm run build
```

### 2. Configure MCP

Add to your Claude Code MCP settings (`.mcp.json` in your project root or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "blip": {
      "command": "node",
      "args": ["/absolute/path/to/Blip/dist/index.js"]
    }
  }
}
```

### 3. Use it

Tell Claude:

> "annotate my preview"

or

> "annotate http://localhost:3000"

A browser window opens with the drawing overlay. Draw your annotations, click **Send to Claude**, and the screenshot appears inline in your chat.

## Tools

### Drawing tools
- **Pen** -- Freehand drawing
- **Arrow** -- Directional arrows
- **Circle** -- Ellipses for circling elements
- **Rectangle** -- Rectangular outlines
- **Highlight** -- Semi-transparent rectangular highlights
- **Text** -- Click to place text labels

### Colors
Five colors: red, blue, green, yellow, white. Three stroke sizes.

### Controls
- **Undo/Redo** -- Cmd+Z / Cmd+Shift+Z
- **Clear** -- Remove all annotations
- **Send to Claude** -- Capture and send screenshot
- **Cancel** -- Exit annotation mode

## Two modes

### CLI (Terminal)
The MCP `annotate` tool opens your page in a browser with the overlay injected. Draw annotations, hit send, the screenshot goes straight back to Claude in your terminal.

### Desktop (Claude Code app)
The drawing overlay also works with Claude Code's built-in preview. Click the pencil FAB to activate, draw on the live preview, then use Ctrl+P to add the screenshot to chat.

## Architecture

```
src/
  index.ts              -- MCP server (annotate tool)
  annotation-server.ts  -- Express server (proxy, save, clipboard)
  dev-server.ts         -- Dev launcher
public/
  overlay.js            -- Injectable annotation canvas
  app.js                -- Standalone annotation editor
  index.html            -- Editor HTML
  style.css             -- Editor styles
  html2canvas.min.js    -- Page capture library
```

The MCP server starts an Express backend that:
- Proxies target URLs and injects the drawing overlay
- Serves a standalone annotation editor for pasted screenshots
- Saves annotated images with metadata (stroke data, viewport info)
- Copies the result to clipboard on macOS for easy pasting

## Development

```bash
npm run dev     # Watch mode for TypeScript
npm run serve   # Start the dev server on port 4460
npm run build   # One-time build
npm start       # Run the MCP server directly
```

## Requirements

- Node.js 18+
- Claude Code with MCP support

## License

MIT
