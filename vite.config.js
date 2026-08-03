import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  cacheDir: '.vite-cache',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 8766,
  },
});
