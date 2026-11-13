import { cwd } from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': loadEnv(mode, cwd(), 'LINKSNAP_').LINKSNAP_API_TARGET || 'http://127.0.0.1:3000',
    },
  },
}))
