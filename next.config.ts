import type { NextConfig } from "next";

// Export statico: l'app è solo HTML/CSS/JS, così si può impacchettare con
// Capacitor per iOS e Android. Niente API route né rendering sul server:
// le chiamate all'AI passano dalle Edge Functions di Supabase.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
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
