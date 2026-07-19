import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base must match the GitHub Pages repository name so assets resolve at
// https://<user>.github.io/armenia-home-calculator/
export default defineConfig({
  base: '/armenia-home-calculator/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
