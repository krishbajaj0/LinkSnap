import { cwd, env } from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { shortLinkProxyPattern } from '../server/src/links/paths.js'
import { buildQrUrl } from './src/services/qrUrl.js'

export default defineConfig(({ command, mode }) => {
  const target = loadEnv(mode, cwd(), 'LINKSNAP_').LINKSNAP_API_TARGET || 'http://127.0.0.1:3000'
  const renderBuild = command === 'build' && env.RENDER === 'true'
  const publicOrigin = renderBuild
    ? env.VITE_PUBLIC_BASE_URL ?? env.RENDER_EXTERNAL_URL ?? ''
    : ''
  const canonicalOrigin = renderBuild ? new URL(buildQrUrl('/sample-link', { configuredOrigin: publicOrigin })).origin : ''

  return {
    plugins: [react()],
    ...(renderBuild && {
      define: { 'import.meta.env.VITE_PUBLIC_BASE_URL': JSON.stringify(canonicalOrigin) },
    }),
    server: {
      proxy: {
        '^/api(?:/|[?]|$)': target,
        [shortLinkProxyPattern]: target,
      },
    },
  }
})
