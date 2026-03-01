import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // Serve index.html for all routes so /admin doesn't 404 in dev
    historyApiFallback: true,
  },
  resolve: {
    // This strictly forces Vite to use only ONE version of React
    dedupe: ['react', 'react-dom']
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker auto-updates silently in the background
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't cache Mapbox tiles or API calls — let them go to network
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Cache Mapbox map tiles for offline map rendering
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: 'MOVZZ — Reliability-Orchestrated Mobility',
        short_name: 'MOVZZ',
        description: 'Book reliable rides ranked by completion confidence across cab, bike, auto and metro.',
        theme_color: '#0d1d35',
        background_color: '#0d1d35',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['travel', 'transportation'],
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Book a Ride',
            short_name: 'Book',
            description: 'Start booking a ride immediately',
            url: '/',
            icons: [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
          {
            name: 'Admin Panel',
            short_name: 'Admin',
            description: 'Open the MOVZZ ops dashboard',
            url: '/admin',
            icons: [{ src: '/icon-192.svg', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
});