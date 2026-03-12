import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/wanted",
        destination: "/community-wishlist",
        permanent: true,
      },
      {
        source: "/my-wants/:path*",
        destination: "/my-wishlist/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9002",
        pathname: "/bookshare-media-dev/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9002",
        pathname: "/bookshare-media-prod/**",
      },
    ],
  },
};

export default nextConfig;
