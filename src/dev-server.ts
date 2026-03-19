// Standalone dev server for previewing the annotation UI
import { startAnnotationServer } from './annotation-server.js';

const port = parseInt(process.argv[2] || '4460');

startAnnotationServer(port).then((actualPort) => {
  console.log(`Blip server running at http://localhost:${actualPort}`);
  console.log(`  Annotation editor: http://localhost:${actualPort}/annotate`);
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
