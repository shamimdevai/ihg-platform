import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// CRITICAL (see Global Context Prompt, Docker section): usePolling and
// hmr.clientPort: 80 are both required together for hot reload to survive
// being proxied through the outer nginx service.
//
// resolve.alias '@' -> src added at Phase 4 for shadcn/ui's import
// convention (@/components/ui/..., @/lib/utils) — not present before this
// phase, flagged as a real infra addition.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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