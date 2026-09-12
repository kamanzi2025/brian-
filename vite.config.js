import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.VITE_BASE_PATH || '/'

// Writes a version.json into the build output so the client can detect new
// deploys via a plain static file — no serverless function required. This
// keeps version-checking working on hosts with no functions runtime (Render
// static sites, GitHub Pages) and avoids waking a sleeping free-tier service
// just to answer a version check.
function versionFilePlugin() {
  return {
    name: 'write-version-file',
    apply: 'build',
    writeBundle(options) {
      const v = process.env.RENDER_GIT_COMMIT || String(Date.now())
      writeFileSync(resolve(options.dir, 'version.json'), JSON.stringify({ v }))
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    versionFilePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'AutoParts Store Manager',
        short_name: 'AutoParts Store',
        description: 'Financial management for auto parts shop',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
