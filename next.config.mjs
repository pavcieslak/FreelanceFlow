import { execSync } from "child_process";
import { readFileSync } from "fs";

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
    NEXT_PUBLIC_GIT_SHA: getGitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
