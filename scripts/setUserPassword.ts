/**
 * Creates a user, or resets an existing user's password, straight against the
 * database — no email delivery involved.
 *
 * This is the way back in when you're self-hosting, have forgotten the
 * password, and haven't configured a mail provider (so the /forgot-password
 * flow can't reach you).
 *
 * Usage:
 *   npm run user:set -- you@example.com "your-password"
 *   AUTH_EMAIL=you@example.com AUTH_PASSWORD=secret npm run user:set
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const [argEmail, argPassword] = process.argv.slice(2);
  // Login lowercases the address before looking it up, so store it lowercased
  // or the account would exist but be impossible to sign in to.
  const email = (argEmail ?? process.env.AUTH_EMAIL ?? "").toLowerCase().trim();
  const password = argPassword ?? process.env.AUTH_PASSWORD ?? "";

  if (!EMAIL_RE.test(email)) {
    throw new Error(
      'Provide a valid email:  npm run user:set -- you@example.com "your-password"'
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    // Clearing passwordChangedAt avoids invalidating the session the operator
    // is about to create; there is nothing to lock out on a manual reset.
    update: { password: hashedPassword, passwordChangedAt: null },
    create: { email, password: hashedPassword },
  });

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, defaultCurrency: "USD", defaultHourlyRate: 0 },
  });

  // Any outstanding reset links for this account are now meaningless.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  console.log(
    existing
      ? `Password reset for existing account: ${email}`
      : `Account created: ${email}`
  );
  console.log("You can now sign in at /login.");
}

main()
  .catch((e) => {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
