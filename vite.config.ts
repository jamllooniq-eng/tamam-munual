import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist/client',
    cssCodeSplit: false,
  },
}));
