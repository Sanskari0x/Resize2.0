/**
 * Server-side security helpers.
 *  - MIME + magic-byte validation (prevents polyglot file attacks)
 *  - Input sanitization  (prevents injection / prototype pollution)
 *  - Allowed-value whitelists (prevents unexpected Sharp options)
 */

// ─── Limits ───────────────────────────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_DIMENSION       = 16_000;            // px – sharp/libvips practical max
export const MIN_DIMENSION       = 1;

// ─── Allowed values (whitelist, not blacklist) ────────────────────────────────
export const ALLOWED_FORMATS   = new Set(["jpeg", "jpg", "png", "webp", "avif", "tiff"]);
export const ALLOWED_FIT       = new Set(["cover", "contain", "fill", "inside", "outside"]);
export const ALLOWED_KERNELS   = new Set(["lanczos3", "lanczos2", "mitchell", "cubic", "linear", "nearest"]);
export const ALLOWED_POSITIONS = new Set([
  "attention", "entropy", "centre", "center",
  "top", "bottom", "left", "right",
  "right top", "right bottom", "left bottom", "left top",
]);
export const ALLOWED_ROTATIONS = new Set([0, 90, 180, 270]);

// ─── Magic bytes for each allowed MIME type ──────────────────────────────────
// Prevents content-type spoofing (e.g. a PHP file renamed to .jpg)
const MAGIC: Array<{ mime: string; sig: number[]; offset: number }> = [
  // JPEG
  { mime: "image/jpeg", sig: [0xFF, 0xD8, 0xFF], offset: 0 },
  // PNG
  { mime: "image/png",  sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
  // WebP  (RIFF....WEBP)
  { mime: "image/webp", sig: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  // GIF
  { mime: "image/gif",  sig: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  // TIFF LE
  { mime: "image/tiff", sig: [0x49, 0x49, 0x2A, 0x00], offset: 0 },
  // TIFF BE
  { mime: "image/tiff", sig: [0x4D, 0x4D, 0x00, 0x2A], offset: 0 },
  // AVIF / HEIF (ftyp box)
  { mime: "image/avif", sig: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  // BMP
  { mime: "image/bmp",  sig: [0x42, 0x4D], offset: 0 },
];

function matchesMagic(buf: Uint8Array, sig: number[], offset: number): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Validate an uploaded file: MIME type, magic bytes, size.
 */
export async function validateImageFile(file: File): Promise<ValidationResult> {
  // 1. Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File too large. Max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`, status: 413 };
  }
  if (file.size < 8) {
    return { ok: false, error: "File is too small to be a valid image.", status: 400 };
  }

  // 2. Declared MIME type whitelist
  const mime = file.type.toLowerCase();
  const allowedMimes = new Set([
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/avif", "image/heic", "image/heif", "image/tiff",
    "image/gif", "image/bmp",
  ]);
  if (!allowedMimes.has(mime)) {
    return { ok: false, error: `Unsupported file type: ${mime}`, status: 415 };
  }

  // 3. Magic-byte verification (read first 16 bytes)
  const slice = file.slice(0, 16);
  const ab    = await slice.arrayBuffer();
  const buf   = new Uint8Array(ab);

  const matched = MAGIC.some(m => matchesMagic(buf, m.sig, m.offset));
  if (!matched) {
    return { ok: false, error: "File content does not match a known image format.", status: 415 };
  }

  return { ok: true };
}

// ─── Sanitize a string param ─────────────────────────────────────────────────
/** Strip anything that isn't a safe printable character. Prevents injection. */
export function sanitizeString(s: unknown, maxLen = 64): string {
  if (typeof s !== "string") return "";
  // Allow alphanumeric, spaces, basic punctuation — nothing executable
  return s.replace(/[^\w\s.\-#%]/g, "").slice(0, maxLen);
}

/** Parse a number and clamp it; returns fallback if NaN. */
export function safeNumber(v: unknown, fallback: number, min: number, max: number): number {
  const n = parseFloat(String(v));
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Parse a boolean from a form string. */
export function safeBool(v: unknown, fallback = false): boolean {
  if (v === "true")  return true;
  if (v === "false") return false;
  return fallback;
}

/** Assert a value is in a whitelist; return fallback if not. */
export function safeEnum<T extends string>(
  v: unknown,
  allowed: Set<T>,
  fallback: T
): T {
  const s = String(v).toLowerCase().trim() as T;
  return allowed.has(s) ? s : fallback;
}

/** Validate a hex colour string like "#rrggbb". Returns "#ffffff" on invalid. */
export function safeHexColor(v: unknown, fallback = "#ffffff"): string {
  const s = String(v).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (s === "transparent") return "transparent";
  return fallback;
}

// ─── XSS: sanitize a value for safe JSON response ───────────────────────────
/** Ensure output string fields can't carry script tags. */
export function sanitizeOutput(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
