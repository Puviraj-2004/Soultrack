import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Soultrack',
        short_name: 'Soultrack',
        description: 'Your songs, your story',
        theme_color: '#ffffff',      // App header background color
        background_color: '#ffffff', // Splash screen background
        display: 'standalone',       // Immersive full-screen app view
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png', // Unga custom 192px icon path [2.2.1]
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // Unga custom 512px icon path [2.2.1]
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'  // Android rounded dynamic icons-ku adaptive tharum [2.2.1]
          }
        ]
      },
      workbox: {
        // Cloudinary media files dynamic range-requests support
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-assets',
              expiration: {
                maxEntries: 100, // Maximum cached files count
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days cache validity
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              rangeRequests: true // iOS Background media standard play-ku compulsory
            }
          }
        ]
      }
    })
  ],
})