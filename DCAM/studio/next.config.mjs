const disableWebpackFilesystemCache = process.env.FIREBASE_DEPLOY_DISABLE_WEBPACK_CACHE === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    // Windows dev builds have been intermittently leaving stale vendor-chunk references
    // in `.next/server/app/*/page.js` without emitting the matching files. Disabling
    // webpack's filesystem cache in local dev keeps the server bundle consistent.
    if (disableWebpackFilesystemCache || dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
