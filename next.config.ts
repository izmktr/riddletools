import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.BASE_PATH ?? '',
  assetPrefix: process.env.BASE_PATH ?? '',
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH ?? '',
  },
  images: {
    unoptimized: true,
  },
  // 開発時のソースマップを有効化（デバッグ用）
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },
};

export default nextConfig;
