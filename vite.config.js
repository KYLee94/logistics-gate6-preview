import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: projectRoot,
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8081,
    strictPort: true, // 포트 꼬임 방지 (8081이 아니면 차라리 에러를 띄움)
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    watch: {
      usePolling: true, // Mac OS 환경에서 파일 변경 이벤트를 100% 감지하도록 강제
      interval: 100,
    },
  hmr: {
      overlay: true,
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@supabase')) return 'vendor-supabase';
          return 'vendor';
        },
      },
    },
  },
})
