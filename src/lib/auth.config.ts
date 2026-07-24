import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the auth configuration.
 *
 * Middleware runs on the Edge runtime, where Prisma and other Node-only
 * modules cannot load. This file therefore contains only route-protection
 * logic and must not import the database client, bcrypt, or anything that
 * pulls them in. The Credentials provider and the session-freshness check
 * live in `auth.ts`, which runs on the Node runtime.
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname === "/login" ||
        nextUrl.pathname === "/register" ||
        nextUrl.pathname === "/forgot-password" ||
        nextUrl.pathname === "/reset-password";

      // Public page shown to invoice payers after Stripe checkout
      if (nextUrl.pathname.startsWith("/pay/")) return true;

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      // This is a coarse gate only — it sees whether a session token is
      // present and validly signed, not whether the account still accepts it.
      // The authoritative check (including password-change invalidation) runs
      // in `auth.ts` on every server component and API route.
      if (!isLoggedIn) return false;
      return true;
    },
    session({ session, token }) {
      if (token) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
