import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

// `--mode artifact` builds everything into one HTML file so it can be published as a private test page.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'artifact' ? 'dist-artifact' : 'dist' },
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] },
}));
