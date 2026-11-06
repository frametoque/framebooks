// src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://books.frametoque.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/user/', '/api/', '/billing/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
