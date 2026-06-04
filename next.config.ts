import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
    ],
  },
  // Necesario para que web-push funcione en servidor
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
