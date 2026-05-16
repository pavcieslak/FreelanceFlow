import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(settings ?? { id: "singleton" });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Handle password change
  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user?.email ?? "" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const hash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  }

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
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
      id: "singleton",
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
