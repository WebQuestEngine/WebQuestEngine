import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function getCommitHash(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.substring(0, 7);
  }
  if (process.env.GIT_COMMIT_HASH) {
    return process.env.GIT_COMMIT_HASH.substring(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

function versionPlugin(): Plugin {
  const commitHash = getCommitHash();
  const versionStr = `v2.0-${commitHash}`;

  return {
    name: 'vite-plugin-version',
    transformIndexHtml(html) {
      return html
        .replace(/__COMMIT_HASH__/g, commitHash)
        .replace(/__APP_VERSION__/g, versionStr)
        .replace(/\[v2\.0-[a-zA-Z0-9_-]+\]/g, `[${versionStr}]`)
        .replace(/\[v2\.0\s+[^\]]+\]/g, `[${versionStr}]`);
    },
    transform(code, id) {
      if (id.endsWith('Toolbar.html') || id.includes('Toolbar.html?raw')) {
        return {
          code: code
            .replace(/__COMMIT_HASH__/g, commitHash)
            .replace(/__APP_VERSION__/g, versionStr)
            .replace(/v2\.0\s*\([a-zA-Z0-9_-]+\)/g, `v2.0 (${commitHash})`)
            .replace(/v2\.0-[a-zA-Z0-9_-]+/g, versionStr),
          map: null
        };
      }
    }
  };
}

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
              const filename = payload.filename || "quest_project.json";
              const rootPath = path.resolve(__dirname, filename);
              const demoPath = path.resolve(__dirname, 'demo', filename);
              const targetPath = fs.existsSync(rootPath) ? rootPath : demoPath;
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
  base: './',
  publicDir: 'demo',
  plugins: [versionPlugin(), localSavePlugin()],
  define: {
    __COMMIT_HASH__: JSON.stringify(getCommitHash()),
    __APP_VERSION__: JSON.stringify(`v2.0-${getCommitHash()}`)
  },
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      ignored: ['**/demo/*.json', '**/*.json']
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        player: path.resolve(__dirname, 'player.html')
      }
    }
  }
});
