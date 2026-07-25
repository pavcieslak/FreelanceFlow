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
const isProd = process.env.NODE_ENV === "production";

// The editor previews of VS Code / Codespaces render the app inside an iframe.
// Denying every ancestor there just shows a blank pane, so development allows
// those embedders. Production keeps the hard 'none'.
const FRAME_ANCESTORS = isProd
  ? "frame-ancestors 'none'"
  : "frame-ancestors 'self' https://*.github.dev https://*.app.github.dev vscode-webview:";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Stripe Checkout redirects out to stripe.com; API calls stay same-origin.
  "connect-src 'self' https://api.stripe.com",
  "form-action 'self' https://checkout.stripe.com",
  FRAME_ANCESTORS,
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // X-Frame-Options has no allow-list equivalent to frame-ancestors, so in
  // development it is omitted entirely rather than silently overriding the CSP
  // above. HSTS is likewise production-only: sent over plain-HTTP localhost it
  // pins the browser to https://localhost for every other project on that port.
  ...(isProd
    ? [
        { key: "X-Frame-Options", value: "DENY" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
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
