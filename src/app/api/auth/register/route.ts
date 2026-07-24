import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rateLimit";
import { logger, serverError } from "@/lib/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 200;
const MAX_NAME_LENGTH = 100;

export async function POST(req: NextRequest) {
  // Signup is the most abusable unauthenticated write endpoint: cap it hard.
  const limit = rateLimit(clientKey(req, "register"), 5, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  // bcrypt silently truncates past 72 bytes; reject long input rather than
  // letting users believe a 300-character password is fully honoured.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Name must be at most ${MAX_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
        settings: { create: { fullName: name || null, email } },
      },
    });

    logger.info("user registered", { userId: user.id });
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    // Unique constraint race between the check above and the insert.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return serverError("registration failed", error);
  }
}
