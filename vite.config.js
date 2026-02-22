import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  build: {
    // This tells Vite/esbuild to support modern features like top-level await
    target: 'esnext',
    // Ensure both app entry points are emitted in production.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
      },
    },
  },
  esbuild: {
    // Also set the target for the minifier/transpiler
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      // Ensure top-level await works during development/pre-bundling
      target: 'esnext'
    }
  }
})