import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // Permet l'accès depuis le réseau
    port: 5173,
    https: {
      key: '../backend/ssl/key.pem',
      cert: '../backend/ssl/cert.pem',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Production optimizations
    target: 'esnext',
    minify: 'esbuild', // Faster than terser
    cssMinify: true,
    sourcemap: false, // Disable in production for smaller bundles
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType === 'html') {
          return deps.filter(dep => !dep.includes('vendor-mapbox'))
        }
        return deps
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mapbox-gl') || id.includes('node_modules/@mapbox/')) {
            return 'vendor-mapbox'
          }

          if (id.includes('node_modules/react-map-gl')) {
            return 'vendor-mapbox-react'
          }

          if (id.includes('node_modules/livekit-client') || id.includes('node_modules/@livekit/')) {
            return 'vendor-livekit'
          }

          if (id.includes('node_modules/recharts')) {
            return 'vendor-recharts'
          }

          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-react-query'
          }

          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix'
          }

          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router-dom')
          ) {
            return 'vendor-react-core'
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide'
          }

          if (id.includes('node_modules/wavesurfer.js') || id.includes('node_modules/fft.js')) {
            return 'vendor-audio'
          }

          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dnd-kit'
          }

          if (id.includes('node_modules/tailwind-merge')) {
            return 'vendor-tailwind'
          }

          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry'
          }

          if (id.includes('node_modules')) {
            return
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 10000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
