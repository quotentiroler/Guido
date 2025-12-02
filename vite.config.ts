import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { guidoTemplatesPlugin } from './vite-plugin-templates';
import { version } from './package.json';

export default defineConfig({
  base: '/Guido',
  plugins: [react(), tailwindcss(), guidoTemplatesPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Suppress warnings for Node.js modules externalized for browser
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || 
            (warning.message && warning.message.includes('externalized for browser compatibility'))) {
          return;
        }
        warn(warning);
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
    // Use 'development' condition for workspace packages during dev
    conditions: ['development'],
  },
});