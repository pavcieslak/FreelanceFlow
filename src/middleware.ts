import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Middleware runs on the Edge runtime, so it uses the database-free config.
// Importing `@/lib/auth` here would pull in Prisma and fail at request time.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons).*)",
  ],
};
