import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Lowercased to match how sign-in looks the address up — otherwise a seeded
  // account with any uppercase would exist but never authenticate.
  const email = process.env.AUTH_EMAIL?.toLowerCase().trim();
  const password = process.env.AUTH_PASSWORD;

  if (!email || !password) {
    throw new Error("AUTH_EMAIL and AUTH_PASSWORD must be set in .env.local");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: { email, password: hashedPassword },
  });

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultCurrency: "USD",
      defaultHourlyRate: 0,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
