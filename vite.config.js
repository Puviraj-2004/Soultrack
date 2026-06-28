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
        theme_color: '#ffffff',      
        background_color: '#ffffff', 
        display: 'standalone',       
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'  
          }
        ]
      },
      workbox: {
        // CORRECTED: Cloudinary audio-vai thavirthu, IMAGES mattum cache seiyum dynamic pattern
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\.(png|jpg|jpeg|webp|gif|svg)/i, // Matches only images
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: {
                maxEntries: 100, 
                maxAgeSeconds: 30 * 24 * 60 * 60 
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})