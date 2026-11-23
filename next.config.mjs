/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  outputFileTracingExcludes: {
    '*': [
      './backups/**/*',
      './scripts/**/*',
      './docs/**/*',
      './*.md',
      './*.log',
      './tsconfig.tsbuildinfo',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'react-icons', 'recharts', 'framer-motion'],
  },
  async redirects() {
    return [
      {
        source: '/user/onboarding',
        destination: '/onboarding',
        permanent: false,
      },
    ];
  },

  async headers() {
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.r2.dev https://*.public.blob.vercel-storage.com https://*.googleusercontent.com https://*.gravatar.com https://*.youtube.com https://*.ytimg.com",
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://app.payments.lk https://api.payments.lk https://sandbox.payments.lk https://va.vercel-scripts.com https://*.google.com https://vitals.vercel-insights.com",
      "frame-ancestors 'self'",
      "form-action 'self' https://app.payments.lk https://sandbox.payments.lk https://accounts.google.com",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },

  images: {
    qualities: [75, 85],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.youtube.com',
        port: '',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: '**.ytimg.com',
        port: '',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-f6c8c42107ba4907896e1f606327fa43.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;