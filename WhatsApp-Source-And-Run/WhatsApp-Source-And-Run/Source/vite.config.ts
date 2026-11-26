import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: ['./index.html', './WhatsApp.tsx'],
          theme: {
            extend: {
              fontFamily: { sans: ['Noto Sans Arabic Variable', 'Tahoma', 'sans-serif'] },
              colors: { primary: { DEFAULT: '#157353', hover: '#105c42' } },
              boxShadow: { card: '0 3px 16px -10px rgb(20 55 43 / .13)' },
            },
          },
          plugins: [],
        }),
        autoprefixer(),
      ],
    },
  },
  build: { outDir: 'dist' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3100', changeOrigin: false } },
  },
});
