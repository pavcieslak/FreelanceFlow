import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rateLimit";
import { emailEnabled, sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { appUrl } from "@/lib/stripe";
import {
  createResetToken,
  resetTokenExpiry,
  renderResetEmail,
  RESET_TOKEN_TTL_MINUTES,
} from "@/lib/passwordReset";

// Deliberately identical whether or not the address is registered, so this
// endpoint can't be used to discover which emails have accounts.
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(req: NextRequest) {
  const byIp = rateLimit(clientKey(req, "forgot-pw-ip"), 10, 60 * 60);
  if (!byIp.allowed) return tooManyRequests(byIp.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Also cap per address, so one mailbox can't be flooded from many IPs.
  const byEmail = rateLimit(`forgot-pw-email:${email}`, 5, 60 * 60);
  if (!byEmail.allowed) return NextResponse.json(GENERIC_RESPONSE);

  if (!emailEnabled()) {
    // Without a mail provider there is no way to deliver the link. Say so
    // plainly — this is a server misconfiguration, not a user error.
    logger.error("password reset requested but email is not configured");
    return NextResponse.json(
      {
        error:
          "Password reset is unavailable because email sending is not configured on this server.",
      },
      { status: 503 }
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Any earlier unused link becomes void, so only the newest email works.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const { token, tokenHash } = createResetToken();
      await prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt: resetTokenExpiry() },
      });

      const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your ProjectFlow password",
        html: renderResetEmail({
          resetUrl,
          expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        }),
      });

      logger.info("password reset email sent", { userId: user.id });
    } else {
      logger.info("password reset requested for unknown email");
    }
  } catch (error) {
    // Never surface the failure shape to the caller — that would leak whether
    // the address exists. It is logged for the operator instead.
    logger.error("password reset request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
