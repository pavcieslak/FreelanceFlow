import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { validateEnv } from "@/lib/env";
import { isConfigured, isGoogleEmailAllowed } from "@/lib/config";

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
 * `src/proxy.ts` deliberately uses only the edge-safe config — do not import
 * this module from there, or Prisma will fail to load in the Edge runtime.
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

        // A Google-only account has no password to compare against. Still burn
        // the same bcrypt work as a wrong password would, so the response time
        // does not reveal which accounts exist or how they sign in.
        if (!user?.password) {
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
    // Only offered when fully configured, which includes the allowlist. The
    // provider list is public via /api/auth/providers, so the sign-in page can
    // show the button exactly when it will work.
    ...(isConfigured("google")
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Gatekeeps Google sign-in and creates or links the local account.
     *
     * Returning false here is the only thing standing between a reachable
     * instance and anyone with a Google account, so the checks are ordered
     * deliberately: the address must be verified by Google, and it must be on
     * the allowlist, before any account is touched.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email?.toLowerCase().trim();
      const googleId = profile?.sub;

      // Google sets email_verified false for addresses it has not confirmed.
      // Matching an unverified address against a local account would let
      // someone claim an account by asserting its email.
      if (!email || !googleId || profile?.email_verified !== true) {
        logger.warn("google sign-in rejected: unverified or incomplete profile");
        return false;
      }

      if (!isGoogleEmailAllowed(email)) {
        logger.warn("google sign-in rejected: address not on the allowlist", { email });
        return false;
      }

      const byGoogleId = await prisma.user.findUnique({ where: { googleId } });
      if (byGoogleId) return true;

      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        // Existing password account, same verified address: adopt the Google
        // identity so either method signs into the one account from now on.
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId, name: byEmail.name ?? user.name ?? null },
        });
        logger.info("linked google identity to existing account", { userId: byEmail.id });
        return true;
      }

      const created = await prisma.user.create({
        data: { email, googleId, name: user.name ?? null, password: null },
      });
      logger.info("created account from google sign-in", { userId: created.id });
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (user) {
        if (account?.provider === "google") {
          // `user.id` is Google's subject, not a row in our database. The
          // account exists by now — signIn created or linked it.
          const email = (profile?.email ?? user.email ?? "").toLowerCase().trim();
          const local = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });
          if (!local) return null;
          token.id = local.id;
          return token;
        }

        token.id = user.id;
        return token;
      }

      // On every subsequent request, check the session was issued after the
      // account's last password change. Without this, a password reset would
      // not sign out whoever already holds a valid session token — which is
      // precisely the case a reset is meant to handle.
      if (!token.id || !token.iat) return token;

      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { passwordChangedAt: true },
      });

      // Account deleted underneath an active session.
      if (!current) return null;

      if (current.passwordChangedAt) {
        const issuedAt = (token.iat as number) * 1000;
        // One second of slack absorbs the truncation of `iat` to whole seconds,
        // which would otherwise invalidate the session created by the reset itself.
        if (issuedAt < current.passwordChangedAt.getTime() - 1000) return null;
      }

      return token;
    },
  },
});
