// src/app/manifest.ts
import type { MetadataRoute } from 'next';
import { DEFAULT_ACCENT_HEX } from '@/lib/theme/accent';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Framebooks',
    short_name: 'Framebooks',
    description: 'Run your entire business in one place. Track money, manage clients, and grow faster.',
    start_url: '/dashboard',
    scope: '/',
    id: '/dashboard',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#0B0F12',
    theme_color: DEFAULT_ACCENT_HEX,
    lang: 'en',
    dir: 'ltr',
    orientation: 'any',
    categories: ['finance', 'business', 'productivity', 'accounting'],
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/favicon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/favicon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'New Invoice',
        short_name: 'New Invoice',
        url: '/invoices/new',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Settings',
        short_name: 'Settings',
        url: '/settings',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
