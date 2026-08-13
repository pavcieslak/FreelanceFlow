import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next 16 renamed this convention from `middleware` to `proxy`; the contract is
// unchanged — same default export, same `config.matcher`. Keeping the old name
// still worked but warned on every build.
//
// This runs on the Edge runtime, so it uses the database-free config. Importing
// `@/lib/auth` here would pull in Prisma and fail at request time.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons).*)",
  ],
};
