<p align="center">
  <img src="logo.png" alt="Blip" width="200" />
</p>

<p align="center">
  Visual annotation MCP server for Claude Code.<br>
  Draw on your preview. Claude sees what you mean.
</p>

---

## How it works

1. Tell Claude: **"annotate"** (or **"annotate http://localhost:3000"**)
2. A browser opens with drawing tools on your page
3. Draw circles, arrows, highlights, text labels
4. Click **Send to Claude** -- the annotated screenshot goes back to your chat
5. Claude updates the code based on what you drew

No more describing UI changes with words. Just draw on them.

## Install

```bash
claude mcp add blip -- npx blip-mcp
```

That's it. Requires [Claude Code](https://claude.com/claude-code) and Node.js 18+.

## Two modes

**CLI (Terminal)** -- The `annotate` MCP tool opens your page in a browser with the overlay injected. Draw, hit send, the screenshot goes straight back to Claude.

**Desktop (Claude Code app)** -- The overlay works with Claude Code's built-in preview. Click the pencil button to activate drawing, then press Ctrl+P to add the screenshot to chat.

## Development

```bash
git clone https://github.com/nebenzu/Blip.git
cd Blip
npm install
npm run build
```

```bash
npm run dev     # Watch mode
npm run serve   # Dev server on port 4460
npm start       # Run MCP server directly
```

## License

MIT
