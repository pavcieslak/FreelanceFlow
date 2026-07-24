import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { validateEnv } from "@/lib/env";

validateEnv();

// A bcrypt hash of a throwaway value. Compared against when no user matches so
// a wrong email and a wrong password take the same time, hiding which accounts
// exist from timing observation.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO.PjkVRxlQTMYRPQpx5H8kmMvBqXQ0Ru";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();

        // Throttle password guessing per account. Keyed by email rather than IP
        // because the attacker controls their IP but not which account they want.
        const limit = rateLimit(`login:${email}`, 10, 15 * 60);
        if (!limit.allowed) {
          logger.warn("login rate limited", { email });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          await bcrypt.compare(credentials.password as string, DUMMY_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          logger.warn("failed login", { userId: user.id });
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      // Public page shown to invoice payers after Stripe checkout
      if (nextUrl.pathname.startsWith("/pay/")) return true;

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token) session.user.id = token.id as string;
      return session;
    },
  },
  session: { strategy: "jwt" },
});
