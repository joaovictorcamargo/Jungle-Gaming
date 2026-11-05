import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // Caminho-base da publicação: `/` por padrão; `BASE_PATH=/Jungle-Gaming/` para o GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // MSW só usa tough-cookie (+ tldts, ~250 KB) para cookies de respostas simuladas; a app não usa cookies.
      'tough-cookie': path.resolve(__dirname, 'src/mocks/vendor/tough-cookie-lite.ts'),
    },
  },
  build: { sourcemap: false, target: 'es2022' },
})
