/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Injects the Fastly Advanced Client-Side Detection (ACSD) script into <head>
// above all other scripts at build time, when VITE_FASTLY_ACSD_FILE is set.
// Script runs synchronously on every page load to detect headless browsers and
// set the _fs_cd_cp_ cookie — no DOM element, no gating, purely passive.
// URL shape: <prefix>assets/<filename>  e.g. /_fs-ch-1T1wmsGaOgGaSxcX/assets/script.js
function fastlyAcsdPlugin(): Plugin {
  return {
    name: 'fastly-acsd',
    transformIndexHtml() {
      const disabled = process.env.VITE_FASTLY_CHALLENGE_DISABLED === 'true';
      const file = (process.env.VITE_FASTLY_ACSD_FILE ?? '').trim();
      if (disabled || !file) return [];
      const prefix = (
        process.env.VITE_FASTLY_CHALLENGE_PREFIX ?? '/_fs-ch-1T1wmsGaOgGaSxcX/'
      ).trim();
      const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      const src = `${normalizedPrefix}assets/${file.replace(/^\/+/, '')}`;
      return [{ tag: 'script', attrs: { src, 'data-fastly-acsd': '' }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  plugins: [fastlyAcsdPlugin(), react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
