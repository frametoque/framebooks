// src/app/manifest.ts
import type { MetadataRoute } from 'next';
import { cookies } from 'next/headers';
import { DEFAULT_ACCENT_HEX } from '@/lib/theme/accent';
import sql from '@/lib/db';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let themeColor = DEFAULT_ACCENT_HEX;

  try {
    const cookieStore = await cookies();
    const cookieColor = cookieStore.get('fb_accent_color')?.value;
    if (cookieColor && /^#[0-9a-fA-F]{6}$/i.test(cookieColor)) {
      themeColor = cookieColor.toUpperCase();
    } else {
      // Check session cookie to find user's tenant accent color from DB
      const sessionToken =
        cookieStore.get('next-auth.session-token')?.value ||
        cookieStore.get('__Secure-next-auth.session-token')?.value;

      if (sessionToken) {
        const rows = await sql`
          SELECT t.accent_color
          FROM sessions s
          JOIN admin_users u ON (s."userId" = u.id OR s."user_id" = u.id)
          JOIN tenants t ON u.tenant_id = t.id
          WHERE s."sessionToken" = ${sessionToken} OR s."session_token" = ${sessionToken}
          LIMIT 1
        `;
        if (rows[0]?.accent_color) {
          themeColor = rows[0].accent_color;
        }
      }
    }
  } catch {
    // Fall back to DEFAULT_ACCENT_HEX on error
  }

  return {
    name: 'Framebooks',
    short_name: 'Framebooks',
    description: 'Run your entire business in one place. Track money, manage clients, and grow faster.',
    start_url: '/user/dashboard',
    scope: '/',
    id: '/user/dashboard',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#0B0F12',
    theme_color: themeColor,
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
        url: '/user/dashboard',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'New Invoice',
        short_name: 'New Invoice',
        url: '/user/invoices/new',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Settings',
        short_name: 'Settings',
        url: '/user/settings',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
