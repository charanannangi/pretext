import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    fs: {
      // Allow serving files from one level up to access pretext files
      allow: ['..']
    }
  }
})
