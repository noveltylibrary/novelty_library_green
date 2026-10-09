import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Public (browser-safe) defaults so the build works on ANY host even when no
// environment variables are configured. Real env vars / .env always win.
const FALLBACK_ENV: Record<string, string> = {
  VITE_SUPABASE_URL: "https://aelcemxrwyddaqaupxaw.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbGNlbXhyd3lkZGFxYXVweGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMjc1ODcsImV4cCI6MjEwNTkwMzU4N30.BwnXpkaIALrXDHmejr9jFEizxuFcKDhArxIFd4GZI7o",
  VITE_COMMUNITY_SUPABASE_URL: "https://lcnbsmoezfkaowcmjbeu.supabase.co",
  VITE_COMMUNITY_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbmJzbW9lemZrYW93Y21qYmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjM1NjksImV4cCI6MjEwMzk5OTU2OX0.OCUmbwuol3z2mkvwRytY_dZr9Pav6Z97iP4rej-wrnY",
};

// Deploying under a sub-path (e.g. GitHub Pages project site)? Set VITE_BASE=/repo-name/
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
const env = loadEnv(mode, process.cwd(), 'VITE_');
const base = process.env.VITE_BASE || env.VITE_BASE || '/';
const define = Object.fromEntries(
  Object.entries(FALLBACK_ENV).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(env[k] || process.env[k] || v)]),
);
return {
  base,
  define,
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Novelty Library',
        short_name: 'Novelty',
        description: 'What book broke your brain this month? A community archive of book reviews.',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        categories: ['books', 'education', 'lifestyle'],
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pre-cache the app shell: HTML, CSS, JS, logos/icons and any bundled fonts.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        navigateFallback: `${base}index.html`,
        // The ad host page is served straight from the network with its own CSP; never precache it or swap in the app shell.
        navigateFallbackDenylist: [/ad-frame\.html/],
        globIgnores: ['**/ad-frame.*'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-styles' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Posters / covers from Supabase Storage: fast repeat views, still refreshed in the background.
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
};
});
