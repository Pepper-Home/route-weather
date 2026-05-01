import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guides: resolve(__dirname, 'guides.html')
      }
    }
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Route Weather',
        short_name: 'RouteWx',
        description: 'Weather forecasts along your motorcycle route',
        theme_color: '#1a1a2e',
        background_color: '#f5f5f0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.weather\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nws-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
            }
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
            }
          },
          {
            urlPattern: /\/api\/distance-matrix/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'distance-matrix-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 14400 }
            }
          }
        ]
      }
    })
  ]
})
