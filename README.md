# ⚡ SmartResize — Photoshop-quality Image Resizer

A professional image resizer built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Sharp** — the fastest image processing library for Node.js, built on libvips.

## ✨ Features

### Resize
- 📐 **Aspect-ratio lock** — resize proportionally like Photoshop's constrain proportions
- 🧠 **AI Smart Crop** (`attention`) — Sharp uses a saliency map to detect faces & subjects before cropping
- 📊 **Entropy-based crop** — focuses on the highest-information region
- 5 **Fit modes**: Cover, Contain, Fill, Inside, Outside
- 6 **Interpolation kernels**: Lanczos3, Lanczos2, Mitchell, Cubic, Linear, Nearest-neighbor
- 🔲 **Transparent background** support for Contain mode
- Quick **presets**: HD, Full HD, 4K, Square, Thumbnail, Banner, Avatar, OG Image

### Enhance
- 🔪 **Smart Sharpen** — Unsharp mask (σ=1.2, like Photoshop's Smart Sharpen)
- ⬛ **Grayscale** — True luminance-based desaturation
- 📊 **Normalise** — Auto-level contrast & brightness
- ↔ **Flip / Mirror** — Horizontal and vertical
- 🗑️ **Strip Metadata** — Remove EXIF, GPS, author info for privacy

### Output
- 5 **formats**: WebP (recommended), AVIF (smallest), JPEG (mozjpeg, progressive), PNG, TIFF
- Fine-grained **quality slider** (10–100%)
- Lossless WebP at quality=100
- Near-lossless WebP at quality≥95
- MozJPEG encoder for best JPEG compression
- Chroma subsampling tuned per quality level

### UI
- 🔀 **Before/After comparison slider** — drag to compare original vs output
- 📊 **Compression stats** — size saved, output dimensions, format
- 🖱 **Drag & drop** upload
- 🌑 Dark cyber theme with DM Sans + DM Mono fonts

## 🚀 Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/smart-resizer.git
cd smart-resizer
npm install
npm run dev
# → http://localhost:3000
```

## 🗂 Project Structure

```
smart-resizer/
├── app/
│   ├── api/
│   │   ├── resize/route.ts      ← Sharp resize engine (POST)
│   │   └── metadata/route.ts    ← Image metadata reader (POST)
│   ├── resizer/page.tsx         ← Main UI
│   ├── layout.tsx
│   ├── page.tsx                 ← Redirects to /resizer
│   └── globals.css
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 🔧 API Reference

### `POST /api/resize`

Accepts `multipart/form-data` with:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | File | required | Source image |
| `width` | number | — | Target width in px |
| `height` | number | — | Target height in px |
| `format` | string | `webp` | `webp` · `avif` · `jpeg` · `png` · `tiff` |
| `quality` | number | `85` | 10–100 |
| `fit` | string | `cover` | `cover` · `contain` · `fill` · `inside` · `outside` |
| `kernel` | string | `lanczos3` | `lanczos3` · `lanczos2` · `mitchell` · `cubic` · `linear` · `nearest` |
| `position` | string | `attention` | `attention` · `entropy` · `centre` · `top` · `bottom` · `left` · `right` |
| `sharpen` | boolean | `false` | Unsharp mask sharpening |
| `grayscale` | boolean | `false` | Convert to grayscale |
| `normalise` | boolean | `false` | Auto-level contrast |
| `flipH` | boolean | `false` | Horizontal mirror |
| `flipV` | boolean | `false` | Vertical mirror |
| `withoutEnlargement` | boolean | `false` | Never upscale |
| `withoutReduction` | boolean | `false` | Never downscale |
| `stripMeta` | boolean | `true` | Remove EXIF/GPS metadata |

**Response:**
```json
{
  "image": "data:image/webp;base64,...",
  "stats": {
    "originalWidth": 3000, "originalHeight": 2000, "originalSize": 2400000,
    "outputWidth": 1920,   "outputHeight": 1280,   "outputSize": 180000,
    "format": "webp", "hasAlpha": false, "channels": 3, "compression": 92
  }
}
```

### `POST /api/metadata`

Returns image metadata without processing — fast, used on file selection.

## 🐙 Push to GitHub

```bash
git init
git add .
git commit -m "feat: smart image resizer with Sharp"
git remote add origin https://github.com/YOUR_USERNAME/smart-resizer.git
git branch -M main
git push -u origin main
```

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Sharp works on Vercel out of the box — it auto-detects the platform and downloads the correct binary.

## 📄 License

MIT
