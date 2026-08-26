import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function localSavePlugin(): Plugin {
  return {
    name: 'vite-plugin-local-save',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/save-file' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const filename = payload.filename || "the_alchemist's_mystery.json";
              const targetPath = path.resolve(__dirname, 'src/demo', filename);
              fs.writeFileSync(targetPath, JSON.stringify(payload.data, null, 2), 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, filepath: targetPath }));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [localSavePlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true
  }
});
