import { defineConfig } from 'vite';
import sitemap from 'vite-plugin-sitemap';

export default defineConfig({
    base: '/',
    build: {
        outDir: 'dist',
    },
    plugins: [
        sitemap({
            hostname: 'https://suika-game-eight.vercel.app',
            routes: [
                '/',
            ],
        }),
  ],
});