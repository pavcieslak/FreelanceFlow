import { execSync } from "child_process";
import { readFileSync } from "fs";

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return process.env.GIT_SHA ?? "unknown";
  }
}

function getAppVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// 'unsafe-inline'/'unsafe-eval' in script-src are required by Next.js's runtime
// (inline bootstrap + hydration payloads). Tightening this further needs
// nonce-based CSP wired through a custom document.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Stripe Checkout redirects out to stripe.com; API calls stay same-origin.
  "connect-src 'self' https://api.stripe.com",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// Browser-hardening headers are production-only. They exist to constrain a
// deployed origin, and in development each one breaks a dev-server feature
// instead:
//
//   CSP     — connect-src 'self' blocks the hot-reload socket whenever the page
//             origin and the socket origin differ, which is the normal case in
//             Codespaces (page on https://<name>-3000.app.github.dev, socket on
//             localhost). That reads as "live reload is dead".
//   HSTS    — sent over plain-HTTP localhost it pins the browser to
//             https://localhost for two years, for every project on that port.
//   XFO     — DENY blanks out the editor's built-in browser preview.
//
// Serving them in dev buys no safety: the dev server is bound to a local port,
// and the deployed app is a separate production build.
const HARDENING_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production" ? HARDENING_HEADERS : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a self-contained server bundle so the Docker image doesn't ship node_modules.
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
    NEXT_PUBLIC_GIT_SHA: getGitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
