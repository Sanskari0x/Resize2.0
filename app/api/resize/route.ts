import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  validateImageFile,
  safeNumber, safeBool, safeEnum, safeHexColor, sanitizeString,
  ALLOWED_FORMATS, ALLOWED_FIT, ALLOWED_KERNELS, ALLOWED_POSITIONS, ALLOWED_ROTATIONS,
  MAX_DIMENSION, MIN_DIMENSION,
} from "@/app/lib/security";
import { rateLimit, getClientIp } from "@/app/lib/rateLimit";

// Next.js 16: runtime = "nodejs" is no longer needed for route handlers.
// Sharp is handled via serverExternalPackages in next.config.ts.
export const maxDuration = 60;

// ─── helper: parse hex "#rrggbb" → {r,g,b} ────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export async function POST(req: NextRequest) {
  // ── Extra per-route rate limit (defence-in-depth beyond middleware) ────────
  const ip = getClientIp(req);
  const rl = rateLimit(`${ip}:resize`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After":          String(rl.retryAfter),
          "X-RateLimit-Limit":    "20",
          "X-RateLimit-Remaining":"0",
        },
      }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // ── File security validation (MIME + magic bytes + size) ─────────────
    const fileCheck = await validateImageFile(file);
    if (!fileCheck.ok) {
      return NextResponse.json({ error: fileCheck.error }, { status: fileCheck.status ?? 400 });
    }

    // ── Sanitize & validate all parameters ───────────────────────────────
    const g = (k: string) => formData.get(k);

    const rawW = g("width")  ? parseInt(String(g("width")))  : undefined;
    const rawH = g("height") ? parseInt(String(g("height"))) : undefined;
    const width  = rawW !== undefined ? clamp(rawW,  MIN_DIMENSION, MAX_DIMENSION) : undefined;
    const height = rawH !== undefined ? clamp(rawH,  MIN_DIMENSION, MAX_DIMENSION) : undefined;

    // Reject impossibly large output requests
    if (width && height && width * height > 268_000_000) {
      return NextResponse.json({ error: "Requested output dimensions are too large." }, { status: 400 });
    }

    const format   = safeEnum(g("format"),   ALLOWED_FORMATS   as Set<string>, "jpeg") as string;
    const quality  = clamp(safeNumber(g("quality"),  85, 1,   100), 1, 100);
    const fit      = safeEnum(g("fit"),      ALLOWED_FIT       as Set<string>, "cover") as string;
    const kernel   = safeEnum(g("kernel"),   ALLOWED_KERNELS   as Set<string>, "lanczos3") as string;
    const position = safeEnum(g("position"), ALLOWED_POSITIONS as Set<string>, "attention") as string;
    const bgColor  = safeHexColor(g("bgColor"), "#ffffff");

    const withoutEnlargement = safeBool(g("withoutEnlargement"));
    const withoutReduction   = safeBool(g("withoutReduction"));
    const flipH    = safeBool(g("flipH"));
    const flipV    = safeBool(g("flipV"));

    // Rotation must be in {0, 90, 180, 270}
    const rawRot = parseInt(String(g("rotation") ?? "0")) as 0|90|180|270;
    const rotation = ALLOWED_ROTATIONS.has(rawRot) ? rawRot : 0;

    const sharpenEnabled = safeBool(g("sharpen"));
    const sharpenSigma   = safeNumber(g("sharpenSigma"),  1.2, 0.3, 10);
    const sharpenFlat    = safeNumber(g("sharpenFlat"),   1.0, 0,   10);
    const sharpenJagged  = safeNumber(g("sharpenJagged"), 2.0, 0,   10);
    const grayscale      = safeBool(g("grayscale"));
    const normalise      = safeBool(g("normalise"));
    const blurEnabled    = safeBool(g("blur"));
    const blurSigma      = safeNumber(g("blurSigma"), 2, 0.3, 100);

    const brightness = safeNumber(g("brightness"), 1.0, 0.1, 3.0);
    const saturation = safeNumber(g("saturation"), 1.0, 0.0, 3.0);
    const hue        = safeNumber(g("hue"),         0, -180, 180);
    const contrast   = safeNumber(g("contrast"),    1.0, 0.1, 3.0);

    const tintEnabled = safeBool(g("tint"));
    const tintColor   = safeHexColor(g("tintColor"), "#ff0000");
    const stripMeta   = safeBool(g("stripMeta"), true);

    // ── Read input ─────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const sourceMeta  = await sharp(inputBuffer).metadata();

    const srcW = sourceMeta.width  ?? 1;
    const srcH = sourceMeta.height ?? 1;

    // ── Build pipeline (correct Sharp order) ──────────────────────────────
    let pipe = sharp(inputBuffer, { limitInputPixels: 268_435_456 });

    // 1. Rotate
    pipe = pipe.rotate(rotation || undefined);

    // 2. Flip/flop
    if (flipH) pipe = pipe.flop();
    if (flipV) pipe = pipe.flip();

    // 3. Resize
    if (width || height) {
      const bg = hexToRgb(bgColor);
      pipe = pipe.resize({
        width:  width  || undefined,
        height: height || undefined,
        fit:    fit    as keyof sharp.FitEnum,
        position,
        kernel: kernel as keyof sharp.KernelEnum,
        withoutEnlargement,
        withoutReduction,
        background: bgColor === "transparent"
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : (fit === "contain" || fit === "fill")
            ? { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
            : { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    // 4. Colour ops
    if (grayscale) pipe = pipe.grayscale();

    const needsModulate =
      Math.abs(brightness - 1.0) > 0.01 ||
      Math.abs(saturation - 1.0) > 0.01 ||
      Math.abs(hue)              > 0.5;
    if (needsModulate && !grayscale) {
      pipe = pipe.modulate({ brightness, saturation, hue });
    } else if (needsModulate && grayscale && Math.abs(brightness - 1.0) > 0.01) {
      pipe = pipe.modulate({ brightness });
    }

    if (Math.abs(contrast - 1.0) > 0.01) {
      const a = contrast;
      const b = Math.round(128 * (1 - contrast));
      pipe = pipe.linear(a, b);
    }

    if (normalise)    pipe = pipe.normalise();
    if (tintEnabled) {
      const { r, g: gr, b } = hexToRgb(tintColor);
      pipe = pipe.tint({ r, g: gr, b });
    }

    // 5. Filters
    if (blurEnabled)    pipe = pipe.blur(blurSigma);
    if (sharpenEnabled) {
      pipe = pipe.sharpen({
        sigma: sharpenSigma, m1: sharpenFlat, m2: sharpenJagged,
        x1: 2.0, y2: 10.0, y3: 20.0,
      });
    }

    // 6. Metadata
    pipe = stripMeta ? pipe.withMetadata({}) : pipe.withMetadata();

    // ── Encode ──────────────────────────────────────────────────────────────
    let outputBuffer: Buffer;
    let mimeType: string;

    switch (format) {
      case "jpeg":
      case "jpg":
        outputBuffer = await pipe.jpeg({
          quality, mozjpeg: true,
          chromaSubsampling: quality >= 80 ? "4:4:4" : "4:2:0",
          progressive: true, optimiseCoding: true,
        }).toBuffer();
        mimeType = "image/jpeg";
        break;
      case "png":
        outputBuffer = await pipe.png({
          compressionLevel: clamp(Math.round((100 - quality) / 11), 0, 9),
          adaptiveFiltering: true, palette: quality < 80,
        }).toBuffer();
        mimeType = "image/png";
        break;
      case "webp":
        outputBuffer = await pipe.webp({
          quality, effort: 4,
          lossless: quality === 100,
          nearLossless: quality >= 95,
          smartSubsample: true, alphaQuality: quality,
        }).toBuffer();
        mimeType = "image/webp";
        break;
      case "avif":
        outputBuffer = await pipe.avif({
          quality, effort: 4, chromaSubsampling: "4:4:4",
        }).toBuffer();
        mimeType = "image/avif";
        break;
      case "tiff":
        outputBuffer = await pipe.tiff({
          quality, compression: "lzw", predictor: "horizontal",
        }).toBuffer();
        mimeType = "image/tiff";
        break;
      default:
        outputBuffer = await pipe.jpeg({ quality, mozjpeg: true }).toBuffer();
        mimeType = "image/jpeg";
    }

    const outMeta = await sharp(outputBuffer).metadata();

    return NextResponse.json({
      image: `data:${mimeType};base64,${outputBuffer.toString("base64")}`,
      stats: {
        originalWidth:  srcW,
        originalHeight: srcH,
        originalSize:   inputBuffer.byteLength,
        outputWidth:    outMeta.width,
        outputHeight:   outMeta.height,
        outputSize:     outputBuffer.byteLength,
        format:         outMeta.format,
        hasAlpha:       outMeta.hasAlpha,
        channels:       outMeta.channels,
        compression:    Math.round((1 - outputBuffer.byteLength / inputBuffer.byteLength) * 100),
      },
    });

  } catch (err: unknown) {
    console.error("[SmartResize] Error:", err);
    // Don't leak internal error details to client
    return NextResponse.json({ error: "Image processing failed. Please try a different image." }, { status: 500 });
  }
}
