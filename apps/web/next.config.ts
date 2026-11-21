import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      // OAuth and MCP discovery documents live at the site root (RFC 8414 and 9728).
      { source: '/.well-known/:path*', destination: `${apiOrigin}/.well-known/:path*` },
    ];
  },
};

export default nextConfig;
