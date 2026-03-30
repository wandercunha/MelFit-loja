/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sistemawbuy.com.br",
      },
    ],
  },
};

export default nextConfig;
