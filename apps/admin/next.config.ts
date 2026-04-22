import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pino spawns a worker thread for its pretty transport and resolves the
  // worker entry file at runtime via require.resolve. Letting webpack bundle
  // these breaks that resolution ("ModuleNotFound .../vendor-chunks/lib/worker.js")
  // and the worker exits on every log call. Leave them as runtime externals.
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

export default nextConfig;
