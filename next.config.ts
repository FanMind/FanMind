import type { NextConfig } from "next";

const enforcedContentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: enforcedContentSecurityPolicy },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const deploymentId = process.env.NEXT_DEPLOYMENT_ID?.trim();

if (deploymentId && !/^[0-9a-f]{40}$/u.test(deploymentId)) {
  throw new Error("NEXT_DEPLOYMENT_ID must be a full lowercase Git commit SHA");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.app.github.dev", "localhost:3000", "127.0.0.1:3000"],
  ...(deploymentId ? { deploymentId } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*.app.github.dev", "localhost:3000", "127.0.0.1:3000"],
    },
  },
};

export default nextConfig;
