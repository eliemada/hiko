import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.HIKO_BUILD_DIR || ".next",
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ["dji-log-parser-js", "@libsql/client", "exceljs", "@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/export/**": ["./src/assets/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
