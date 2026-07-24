import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const settings = await prisma.settings.findUnique({ where: { userId } });
  return NextResponse.json(settings ?? { userId });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();

  // Handle password change
  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const hash = await bcrypt.hash(body.newPassword, 12);
    // Stamping passwordChangedAt drops every existing session, including this
    // one. That is the point: if you change your password because someone else
    // got in, they must be signed out too.
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, passwordChangedAt: new Date() },
    });
  }

  const settings = await prisma.settings.upsert({
    where: { userId },
    update: {
      ...(body.fullName !== undefined && { fullName: body.fullName || null }),
      ...(body.businessName !== undefined && { businessName: body.businessName || null }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.logo !== undefined && { logo: body.logo || null }),
      ...(body.defaultCurrency !== undefined && { defaultCurrency: body.defaultCurrency }),
      ...(body.defaultHourlyRate !== undefined && { defaultHourlyRate: body.defaultHourlyRate }),
      ...(body.monthlyExpenses !== undefined && { monthlyExpenses: body.monthlyExpenses }),
    },
    create: {
      userId,
      fullName: body.fullName || null,
      businessName: body.businessName || null,
      email: body.email || null,
      address: body.address || null,
      phone: body.phone || null,
      logo: body.logo || null,
      defaultCurrency: body.defaultCurrency || "USD",
      defaultHourlyRate: body.defaultHourlyRate ?? 0,
      monthlyExpenses: body.monthlyExpenses ?? 0,
    },
  });

  return NextResponse.json(settings);
}
