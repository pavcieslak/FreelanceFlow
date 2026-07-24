import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { validateEnv } from "@/lib/env";

validateEnv();

// A bcrypt hash of a throwaway value. Compared against when no user matches so
// a wrong email and a wrong password take the same time, hiding which accounts
// exist from timing observation.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO.PjkVRxlQTMYRPQpx5H8kmMvBqXQ0Ru";

/**
 * Node-runtime auth. Extends the edge-safe config in `auth.config.ts` with the
 * pieces that need a database: credential verification and the check that a
 * session predates the account's last password change.
 *
 * Middleware deliberately uses only the edge-safe config — do not import this
 * module from middleware, or Prisma will fail to load in the Edge runtime.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        return token;
      }

      // On every subsequent request, check the session was issued after the
      // account's last password change. Without this, a password reset would
      // not sign out whoever already holds a valid session token — which is
      // precisely the case a reset is meant to handle.
      if (!token.id || !token.iat) return token;

      const account = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { passwordChangedAt: true },
      });

      // Account deleted underneath an active session.
      if (!account) return null;

      if (account.passwordChangedAt) {
        const issuedAt = (token.iat as number) * 1000;
        // One second of slack absorbs the truncation of `iat` to whole seconds,
        // which would otherwise invalidate the session created by the reset itself.
        if (issuedAt < account.passwordChangedAt.getTime() - 1000) return null;
      }

      return token;
    },
  },
});
