/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/work',
        destination: '/projects',
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/projects/photography",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/services/photo-video",
        permanent: true,
      },
    ];
  },

  images: {
    qualities: [100, 75],
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
    ],
  },
};

export default nextConfig;