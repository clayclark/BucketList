import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

export default defineConfig(({ mode }) => {
  // The extension calls ESPN with your Chrome login. In `pnpm dev` the page is on localhost, so a proxy
  // forwards ESPN_S2 / ESPN_SWID from .env.local to reach a private league.
  const env = loadEnv(mode, process.cwd(), 'ESPN_')
  const espnProxy: Record<string, ProxyOptions> = {
    '/espn': {
      target: 'https://lm-api-reads.fantasy.espn.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/espn/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (env.ESPN_S2 && env.ESPN_SWID) proxyReq.setHeader('cookie', `espn_s2=${env.ESPN_S2}; SWID=${env.ESPN_SWID}`)
        })
      },
    },
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: espnProxy },
  }
})
