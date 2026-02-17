import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Garantir que imports absolutos ou específicos funcionem se necessário
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});