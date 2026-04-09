// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    // Copy manifest.json to dist after build
    {
        name: 'copy-extension-files',
        closeBundle() {
            const { copyFileSync, mkdirSync, readdirSync } = require('fs');
            mkdirSync('dist/icons', { recursive: true });
            copyFileSync('manifest.json', 'dist/manifest.json');
            // Copy all icons
            readdirSync('public/icons').forEach(f => {
                copyFileSync(`public/icons/${f}`, `dist/icons/${f}`);
        });
    },
},
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',

    rollupOptions: {
      input: {
        popup:      resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          return '[name].[hash].js';
        },
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});