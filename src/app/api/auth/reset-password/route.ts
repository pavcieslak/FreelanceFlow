import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rateLimit";
import { logger, serverError } from "@/lib/logger";
import {
  hashResetToken,
  validatePassword,
  passwordProblemMessage,
} from "@/lib/passwordReset";

const INVALID_TOKEN = {
  error: "This reset link is invalid or has expired. Please request a new one.",
};

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "reset-pw"), 10, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) return NextResponse.json(INVALID_TOKEN, { status: 400 });

  const problem = validatePassword(password);
  if (problem) {
    return NextResponse.json(
      { error: passwordProblemMessage(problem) },
      { status: 400 }
    );
  }

  try {
    // Look the token up by its hash — the raw value is never stored, so this
    // is both the lookup key and the proof of possession.
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(INVALID_TOKEN, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        // passwordChangedAt invalidates sessions issued before this moment, so
        // whoever held the old password is signed out everywhere.
        data: { password: hashed, passwordChangedAt: now },
      }),
      // Burn this token and any other outstanding one for the account.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    logger.info("password reset completed", { userId: record.userId });
    return NextResponse.json({ message: "Your password has been updated." });
  } catch (error) {
    return serverError("password reset failed", error);
  }
}
