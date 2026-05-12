import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // App shell: precache all JS + CSS bundles at SW install
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // No offline fallback UI — app shell only
        runtimeCaching: [
          {
            // Map tiles: cache-first, max 500 entries, 30 day TTL
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },

      // PWA manifest
      manifest: {
        name: 'WhereIs?',
        short_name: 'WhereIs',
        description: "Private location network — Cherry's Labs",
        theme_color: '#ec4899',
        background_color: '#080808',
        display: 'standalone',
        start_url: '/map',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },

      // Include generated icons in the build
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
    }),
  ],

  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
