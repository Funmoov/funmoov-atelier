const withPWA = require("next-pwa");

const env = process.env.NODE_ENV;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // funmoov-atelier : on n'arrête pas le build pour des warnings ESLint
  // (moovy d'origine en a beaucoup, on ne va pas les corriger un par un).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Idem pour TypeScript — sécurité supplémentaire si un type strict bloque.
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/my_vanmoof_com/:path",
          destination: "https://my.vanmoof.com/api/v8/:path",
        },
        {
          source: "/api/api_vanmoof-api_com/:path",
          destination: "https://api.vanmoof-api.com/v8/:path",
        },
        {
          source:
            "/api/api_vanmoof-api_com/getBikeSharingInvitationsForBike/:path",
          destination:
            "https://api.vanmoof-api.com/v8/getBikeSharingInvitationsForBike/:path",
        },
        {
          source: "/api/api_vanmoof-api_com/revokeBikeSharingInvitation/:path",
          destination:
            "https://api.vanmoof-api.com/v8/revokeBikeSharingInvitation/:path",
        },
      ],
    };
  },
  pwa: {
    dest: "public",
  },
};

module.exports = env === "development" ? nextConfig : withPWA(nextConfig);
