/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const port = Number(process.env.ARC_WEB_PORT) || 5173

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    // design-system CSS lives at the repo root, outside apps/web
    fs: { allow: ['../..'] },
  },
  preview: {
    port,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
