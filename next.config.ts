import type { NextConfig } from 'next';
const config: NextConfig = {
  agentRules: false,
  turbopack: { root: process.cwd() },
  devIndicators: false,
  async headers() {
    return ['images', 'audio', 'models'].map((dir) => ({
      source: `/${dir}/:path*`,
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    }));
  },
};
export default config;
