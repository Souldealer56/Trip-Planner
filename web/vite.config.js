import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', ['SUPABASE_', 'VITE_'])
  const supabaseUrl = env.SUPABASE_URL || 'https://obilxzpljuphlkkchnam.supabase.co'

  return {
    plugins: [react()],
    envDir: '../',
    envPrefix: ['SUPABASE_', 'VITE_'],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/supabase-api': {
          target: supabaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase-api/, '')
        }
      }
    }
  }
})

