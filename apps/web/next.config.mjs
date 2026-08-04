/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.HEXVAULT_API_URL || "http://127.0.0.1:3850";
    return [{ source: "/api/hex/:path*", destination: `${api}/:path*` }];
  },
};
export default nextConfig;
