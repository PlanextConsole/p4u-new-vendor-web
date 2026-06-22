/** @type {import('next').NextConfig} */
const gatewayTarget =
  process.env.API_GATEWAY_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8080";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  /** Proxy /api → gateway when the browser uses same-origin `/api` (NEXT_PUBLIC unset). */
  async rewrites() {
    const dest = String(gatewayTarget).replace(/\/$/, "");
    return [
      { source: "/api/:path*", destination: `${dest}/api/:path*` },
      { source: "/vendor-uploads/:path*", destination: `${dest}/vendor-uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
