import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9002",
        pathname: "/book-covers/**",
      },
    ],
  },
};

export default nextConfig;
