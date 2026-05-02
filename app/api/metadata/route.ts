import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Next.js 16: runtime = "nodejs" no longer needed for route handlers.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buffer).metadata();

    return NextResponse.json({
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: buffer.byteLength,
      hasAlpha: meta.hasAlpha,
      channels: meta.channels,
      space: meta.space,
      density: meta.density,
      exif: !!meta.exif,
      icc: !!meta.icc,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
