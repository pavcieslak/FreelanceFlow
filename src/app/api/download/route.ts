import { NextResponse } from "next/server";
import { readFileSync } from "fs";

export async function GET() {
  try {
    const file = readFileSync("/tmp/freelanceflow.zip");
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="freelanceflow.zip"',
        "Content-Length": String(file.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
