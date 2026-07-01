/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Build timestamp shown in the footer so it's obvious which build is live.
// Captured whenever the client is built.
const buildTime = new Date().toISOString();

// Injects the Fastly Advanced Client-Side Detection (ACSD) script into <head>
// above all other scripts at build time, when VITE_FASTLY_ACSD_FILE is set.
// Script runs synchronously on every page load to detect headless browsers and
// set the _fs_cd_cp_ cookie — no DOM element, no gating, purely passive.
// URL shape: <prefix>assets/<filename>  e.g. /_fs-ch-1T1wmsGaOgGaSxcX/assets/script.js
//
// Env vars are read in configResolved (via Vite's loadEnv) rather than
// process.env, because process.env may not yet be populated when the plugin
// factory runs during config evaluation.
function fastlyAcsdPlugin(): Plugin {
  let file = '';
  let disabled = false;
  let prefix = '/_fs-ch-1T1wmsGaOgGaSxcX/';

  return {
    name: 'fastly-acsd',
    configResolved(config) {
      // loadEnv with '' prefix returns all vars from .env files (including
      // VITE_* ones), merged with any that were already in process.env.
      const env = loadEnv(config.mode, config.root, '');
      file = (env.VITE_FASTLY_ACSD_FILE ?? '').trim();
      disabled = (env.VITE_FASTLY_CHALLENGE_DISABLED ?? '') === 'true';
      prefix = (env.VITE_FASTLY_CHALLENGE_PREFIX ?? '/_fs-ch-1T1wmsGaOgGaSxcX/').trim();
    },
    transformIndexHtml() {
      if (disabled || !file) return [];
      const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      const src = `${normalizedPrefix}assets/${file.replace(/^\/+/, '')}`;
      return [{ tag: 'script', attrs: { src, 'data-fastly-acsd': '' }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
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
