import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // 상대 경로로 빌드
  build: {
    outDir: 'dist',
  },
});