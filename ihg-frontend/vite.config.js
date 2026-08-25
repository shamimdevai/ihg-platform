import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CRITICAL (see Global Context Prompt, Docker section): usePolling and
// hmr.clientPort: 80 are both required together for hot reload to survive
// being proxied through the outer nginx service. Do not remove either one
// independently — a plain `proxy_pass` on nginx's side is not sufficient
// on its own.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 80,
    },
  },
})