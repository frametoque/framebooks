/** @type {import('next').NextConfig} */

const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
let r2PublicOrigin = '';
let r2PublicHostname = '';
if (r2PublicUrl) {
  try {
    const parsed = new URL(r2PublicUrl);
    r2PublicOrigin = parsed.origin;
    r2PublicHostname = parsed.hostname;
  } catch {}
}

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
      './tests/**/*',
      './*.md',
      './*.log',
      './*.sql',
      './tsconfig.tsbuildinfo',
      './.git/**/*',
      './coverage/**/*',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: [
      'lucide-react',
      'react-icons',
      'recharts',
      'framer-motion',
      'date-fns',
      'jspdf',
      'pdf-lib',
    ],
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

  async rewrites() {
    return [
      // Clean top-level user routes matching /pos convention
      { source: '/dashboard', destination: '/user/dashboard' },
      { source: '/invoices', destination: '/user/invoices' },
      { source: '/invoices/:path*', destination: '/user/invoices/:path*' },
      { source: '/invoice/:path*', destination: '/user/invoice/:path*' },
      { source: '/income', destination: '/user/income' },
      { source: '/income/:path*', destination: '/user/income/:path*' },
      { source: '/expenses', destination: '/user/expenses' },
      { source: '/expenses/:path*', destination: '/user/expenses/:path*' },
      { source: '/accounts', destination: '/user/accounts' },
      { source: '/accounts/:path*', destination: '/user/accounts/:path*' },
      { source: '/quotations', destination: '/user/quotations' },
      { source: '/quotations/:path*', destination: '/user/quotations/:path*' },
      { source: '/clients', destination: '/user/clients' },
      { source: '/clients/:path*', destination: '/user/clients/:path*' },
      { source: '/assets', destination: '/user/assets' },
      { source: '/assets/:path*', destination: '/user/assets/:path*' },
      { source: '/assests', destination: '/user/assets' },
      { source: '/assests/:path*', destination: '/user/assets/:path*' },
      { source: '/stock', destination: '/user/stock' },
      { source: '/stock/:path*', destination: '/user/stock/:path*' },
      { source: '/reports', destination: '/user/reports' },
      { source: '/reports/:path*', destination: '/user/reports/:path*' },
      { source: '/settings', destination: '/user/settings' },
      { source: '/settings/:path*', destination: '/user/settings/:path*' },
      { source: '/logs', destination: '/user/logs' },
      { source: '/logs/:path*', destination: '/user/logs/:path*' },
      { source: '/user/pos', destination: '/pos' },
    ];
  },

  async headers() {
    const r2PublicEnvUrl = process.env.R2_PUBLIC_URL || '';
    let dynamicR2Origin = '';
    if (r2PublicEnvUrl) {
      try {
        dynamicR2Origin = new URL(r2PublicEnvUrl).origin;
      } catch {}
    }

    const imgSrcList = [
      "'self'",
      "data:",
      "blob:",
      "https://pub-f6c8c42107ba4907896e1f606327fa43.r2.dev",
      ...(dynamicR2Origin ? [dynamicR2Origin] : []),
      "https://*.r2.dev",
      "https://*.r2.cloudflarestorage.com",
      "https://*.public.blob.vercel-storage.com",
      "https://*.googleusercontent.com",
      "https://lh3.googleusercontent.com",
      "https://*.gravatar.com",
      "https://gravatar.com",
      "https://*.githubusercontent.com",
      "https://*.youtube.com",
      "https://*.ytimg.com",
    ].filter(Boolean);

    const connectSrcList = [
      "'self'",
      "https://pub-f6c8c42107ba4907896e1f606327fa43.r2.dev",
      ...(dynamicR2Origin ? [dynamicR2Origin] : []),
      "https://*.r2.cloudflarestorage.com",
      "https://*.r2.dev",
      "https://app.payments.lk",
      "https://api.payments.lk",
      "https://sandbox.payments.lk",
      "https://va.vercel-scripts.com",
      "https://*.google.com",
      "https://vitals.vercel-insights.com",
    ].filter(Boolean);

    const uniqueImgSrc = [...new Set(imgSrcList)].join(" ");
    const uniqueConnectSrc = [...new Set(connectSrcList)].join(" ");
    const isDev = process.env.NODE_ENV !== "production";

    const cspHeader = [
      "default-src 'self'",
      `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://cdnjs.cloudflare.com https://va.vercel-scripts.com`.replace(/\s+/g, " ").trim(),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      `img-src ${uniqueImgSrc}`,
      `connect-src ${uniqueConnectSrc}`,
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
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
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
      ...(r2PublicHostname && r2PublicHostname !== 'pub-f6c8c42107ba4907896e1f606327fa43.r2.dev' ? [{
        protocol: 'https',
        hostname: r2PublicHostname,
        port: '',
        pathname: '/**',
      }] : []),
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.gravatar.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gravatar.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;