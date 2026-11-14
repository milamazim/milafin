import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // restauração de backup (.json) via Server Action; a Vercel aceita até 4,5 MB
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    // A tela inicial é a de lançamentos (E1). Temporário (307) para poder mudar.
    return [{ source: "/", destination: "/lancamentos", permanent: false }];
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
