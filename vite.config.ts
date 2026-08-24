import { defineConfig } from 'vite';

export default defineConfig({
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
