import { cwd } from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { shortLinkProxyPattern } from '../server/src/links/paths.js'

export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, cwd(), 'LINKSNAP_').LINKSNAP_API_TARGET || 'http://127.0.0.1:3000'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '^/api(?:/|[?]|$)': target,
        [shortLinkProxyPattern]: target,
      },
    },
  }
})
