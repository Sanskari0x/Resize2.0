"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "../components/ThemeProvider";
import { fileBridge } from "../lib/fileBridge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Unit   = "px" | "cm" | "mm" | "in" | "%";
type Status = "pending" | "processing" | "done" | "error";

interface ImageMeta {
  width: number; height: number; format: string;
  size: number; hasAlpha: boolean; exif: boolean;
}
interface ResizeStats {
  originalWidth: number; originalHeight: number; originalSize: number;
  outputWidth: number; outputHeight: number; outputSize: number;
  format: string; hasAlpha: boolean; compression: number;
}
interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  meta: ImageMeta | null;
  status: Status;
  progress: number;
  output: string | null;
  stats: ResizeStats | null;
  error: string | null;
}
interface ResizeOptions {
  width: string; height: string; lockAspect: boolean;
  fit: string; kernel: string; position: string;
  format: string; quality: number;
  withoutEnlargement: boolean; withoutReduction: boolean;
  // Transform
  flipH: boolean; flipV: boolean; rotation: number;
  // Enhance
  sharpen: boolean; sharpenSigma: number; sharpenFlat: number; sharpenJagged: number;
  grayscale: boolean; normalise: boolean;
  blur: boolean; blurSigma: number;
  // Adjustments
  brightness: number; saturation: number; hue: number; contrast: number;
  // Tint
  tint: boolean; tintColor: string;
  // Output
  bgColor: string; stripMeta: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONCURRENT = 3;

const ASPECT_RATIOS = [
  { label: "Free",  ratio: null },
  { label: "1:1",   ratio: 1 },
  { label: "4:3",   ratio: 4/3 },
  { label: "3:2",   ratio: 3/2 },
  { label: "16:9",  ratio: 16/9 },
  { label: "9:16",  ratio: 9/16 },
  { label: "2:3",   ratio: 2/3 },
  { label: "3:4",   ratio: 3/4 },
  { label: "21:9",  ratio: 21/9 },
];

const SCALE_SHORTCUTS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "75%", pct: 0.75 },
  { label: "100%", pct: 1.0 },
  { label: "2×", pct: 2.0 },
];

const FIT_MODES = [
  { value: "cover",   icon: "▣", label: "Cover",   desc: "Fill & crop excess" },
  { value: "contain", icon: "◻", label: "Contain", desc: "Fit inside, letterbox" },
  { value: "fill",    icon: "▦", label: "Fill",    desc: "Stretch to exact size" },
  { value: "inside",  icon: "⊡", label: "Inside",  desc: "No crop" },
  { value: "outside", icon: "⊟", label: "Outside", desc: "Cover, may overflow" },
];
const SMART_POSITIONS = [
  { value: "attention", label: "Smart Focus", desc: "AI: faces & subjects" },
  { value: "entropy",   label: "Entropy",     desc: "Highest-detail region" },
  { value: "centre",    label: "Center",      desc: "Crop from center" },
  { value: "top",       label: "Top",         desc: "Anchor top" },
  { value: "bottom",    label: "Bottom",      desc: "Anchor bottom" },
  { value: "left",      label: "Left",        desc: "Anchor left" },
  { value: "right",     label: "Right",       desc: "Anchor right" },
];
const KERNELS = [
  { value: "lanczos3", label: "Lanczos3", desc: "Best quality" },
  { value: "lanczos2", label: "Lanczos2", desc: "Slightly faster" },
  { value: "mitchell", label: "Mitchell", desc: "Balanced" },
  { value: "cubic",    label: "Cubic",    desc: "Smooth edges" },
  { value: "linear",   label: "Linear",   desc: "Fast & soft" },
  { value: "nearest",  label: "Nearest",  desc: "Pixel art" },
];
const FORMATS = [
  { value: "jpeg", label: "JPEG", badge: "Recommended", color: "#F59E0B" },
  { value: "webp", label: "WebP", badge: "Modern",      color: "#00E5FF" },
  { value: "avif", label: "AVIF", badge: "Smallest",    color: "#7C3AED" },
  { value: "png",  label: "PNG",  badge: "Lossless",    color: "#10B981" },
  { value: "tiff", label: "TIFF", badge: "Print",       color: "#6366F1" },
];
const PRESETS = [
  { label: "HD",      w: 1280, h: 720  },
  { label: "Full HD", w: 1920, h: 1080 },
  { label: "4K",      w: 3840, h: 2160 },
  { label: "Square",  w: 1024, h: 1024 },
  { label: "Thumb",   w: 300,  h: 300  },
  { label: "Banner",  w: 1200, h: 628  },
  { label: "Avatar",  w: 256,  h: 256  },
  { label: "OG",      w: 1200, h: 630  },
];
const UNITS: { value: Unit; label: string; desc: string }[] = [
  { value: "px", label: "px", desc: "Pixels — screen & web" },
  { value: "cm", label: "cm", desc: "Centimetres — print" },
  { value: "mm", label: "mm", desc: "Millimetres — precision" },
  { value: "in", label: "in", desc: "Inches — US print" },
  { value: "%",  label: "%",  desc: "% of original size" },
];
const DPI_PRESETS = [72, 96, 150, 300, 600];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}
function toPixels(val: number, unit: Unit, dpi: number, origPx: number): number {
  switch (unit) {
    case "cm": return Math.round((val / 2.54) * dpi);
    case "mm": return Math.round((val / 25.4) * dpi);
    case "in": return Math.round(val * dpi);
    case "%":  return Math.round((val / 100) * origPx);
    default:   return Math.round(val);
  }
}
function fromPixels(px: number, unit: Unit, dpi: number, origPx: number): string {
  switch (unit) {
    case "cm": return ((px / dpi) * 2.54).toFixed(2);
    case "mm": return ((px / dpi) * 25.4).toFixed(1);
    case "in": return (px / dpi).toFixed(3);
    case "%":  return ((px / origPx) * 100).toFixed(1);
    default:   return String(px);
  }
}
function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── useBreakpoint hook ────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(1280);
  useEffect(() => {
    const upd = () => setW(window.innerWidth);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  return { isMobile: w < 640, isTablet: w < 1024, width: w };
}

// ─── Main Component ───────────────────────────────────────────────────────────
function ResizerPageInner() {
  const { isMobile, isTablet } = useBreakpoint();
  const searchParams = useSearchParams();

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // for preview
  const processingCount = useRef(0);

  // UI state
  const [dragging,   setDragging]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<"resize"|"enhance"|"output">("resize");
  const [sideOpen,   setSideOpen]   = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Shared resize options (applied to all queue items)
  const [opts, setOpts] = useState<ResizeOptions>({
    width: "", height: "", lockAspect: true,
    fit: "cover", kernel: "lanczos3", position: "attention",
    format: "jpeg", quality: 85,
    withoutEnlargement: false, withoutReduction: false,
    // Transform
    flipH: false, flipV: false, rotation: 0,
    // Enhance
    sharpen: false, sharpenSigma: 1.2, sharpenFlat: 1.0, sharpenJagged: 2.0,
    grayscale: false, normalise: false,
    blur: false, blurSigma: 2,
    // Adjustments
    brightness: 1.0, saturation: 1.0, hue: 0, contrast: 1.0,
    // Tint
    tint: false, tintColor: "#ff6600",
    // Output
    bgColor: "#ffffff", stripMeta: true,
  });
  const set = <K extends keyof ResizeOptions>(k: K, v: ResizeOptions[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  // Unit system
  const [unit, setUnit] = useState<Unit>("px");
  const [dpi,  setDpi]  = useState(96);
  const [dispW, setDispW] = useState("");
  const [dispH, setDispH] = useState("");
  const origW = useRef(0);
  const origH = useRef(0);
  const aspectRatio = useRef(1);

  // ── Derived ──
  const selectedItem = queue.find(q => q.id === selected) ?? null;

  // ── Pick up file passed from landing page via module-level bridge ──
  useEffect(() => {
    if (searchParams.get("fromLanding") !== "1") return;
    const file = fileBridge.get();
    fileBridge.clear(); // consume immediately so re-navigating doesn't re-add
    if (!file) return;
    addFiles([file]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pendingCount    = queue.filter(q => q.status === "pending").length;
  const processingItems = queue.filter(q => q.status === "processing").length;
  const doneCount       = queue.filter(q => q.status === "done").length;
  const errorCount      = queue.filter(q => q.status === "error").length;
  const totalSaved = queue
    .filter(q => q.stats)
    .reduce((acc, q) => acc + (q.stats!.originalSize - q.stats!.outputSize), 0);

  // ── Add files to queue ──
  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (!images.length) return;

    const newItems: QueueItem[] = images.map(f => ({
      id: uid(), file: f,
      previewUrl: URL.createObjectURL(f),
      meta: null, status: "pending", progress: 0,
      output: null, stats: null, error: null,
    }));

    setQueue(q => [...q, ...newItems]);

    // Auto-select first added if nothing selected
    setSelected(prev => prev ?? newItems[0].id);

    // Fetch metadata for each in background
    for (const item of newItems) {
      const fd = new FormData(); fd.append("file", item.file);
      fetch("/api/metadata", { method: "POST", body: fd })
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setQueue(q => q.map(qi =>
              qi.id === item.id ? { ...qi, meta: data } : qi
            ));
            // Set dimension defaults from first image
            if (!origW.current) {
              origW.current = data.width;
              origH.current = data.height;
              aspectRatio.current = data.width / data.height;
              setDispW(String(data.width));
              setDispH(String(data.height));
              setOpts(o => ({ ...o, width: String(data.width), height: String(data.height) }));
            }
          }
        }).catch(() => {});
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  // ── Process a single item ──
  const processItem = useCallback(async (item: QueueItem, currentOpts: ResizeOptions) => {
    processingCount.current++;
    setQueue(q => q.map(qi => qi.id === item.id
      ? { ...qi, status: "processing", progress: 0, error: null } : qi));

    const tick = setInterval(() => {
      setQueue(q => q.map(qi => qi.id === item.id && qi.status === "processing"
        ? { ...qi, progress: Math.min(qi.progress + 9, 88) } : qi));
    }, 140);

    try {
      const fd = new FormData();
      fd.append("file", item.file);
      if (currentOpts.width)  fd.append("width",  currentOpts.width);
      if (currentOpts.height) fd.append("height", currentOpts.height);
      Object.entries(currentOpts).forEach(([k, v]) => {
        if (k !== "width" && k !== "height" && k !== "lockAspect") fd.append(k, String(v));
      });
      const res  = await fetch("/api/resize", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQueue(q => q.map(qi => qi.id === item.id
        ? { ...qi, status: "done", progress: 100, output: data.image, stats: data.stats } : qi));
    } catch (e: unknown) {
      setQueue(q => q.map(qi => qi.id === item.id
        ? { ...qi, status: "error", progress: 0, error: e instanceof Error ? e.message : "Failed" } : qi));
    } finally {
      clearInterval(tick);
      processingCount.current--;
    }
  }, []);

  // ── Queue runner — up to MAX_CONCURRENT at once ──
  const runQueue = useCallback(async (currentOpts: ResizeOptions) => {
    const pending = queue.filter(q => q.status === "pending");
    if (!pending.length) return;

    const slots = MAX_CONCURRENT - processingCount.current;
    const batch = pending.slice(0, slots);
    await Promise.all(batch.map(item => processItem(item, currentOpts)));

    // Recursively pick up remaining pending
    setQueue(q => {
      const stillPending = q.filter(qi => qi.status === "pending");
      if (stillPending.length && processingCount.current < MAX_CONCURRENT) {
        const next = stillPending.slice(0, MAX_CONCURRENT - processingCount.current);
        next.forEach(item => processItem(item, currentOpts));
      }
      return q;
    });
  }, [queue, processItem]);

  // Process all pending
  const handleProcessAll = () => runQueue(opts);

  // Process just one
  const handleProcessOne = (item: QueueItem) => processItem(item, opts);

  // Remove from queue
  const removeItem = (id: string) => {
    setQueue(q => q.filter(qi => qi.id !== id));
    setSelected(prev => prev === id ? (queue.find(q => q.id !== id)?.id ?? null) : prev);
  };

  // Clear done items
  const clearDone = () => {
    setQueue(q => q.filter(qi => qi.status !== "done"));
    setSelected(prev => {
      const doneIds = queue.filter(q => q.status === "done").map(q => q.id);
      return doneIds.includes(prev ?? "") ? null : prev;
    });
  };

  // Retry errored
  const retryItem = (item: QueueItem) => {
    setQueue(q => q.map(qi => qi.id === item.id
      ? { ...qi, status: "pending", error: null, progress: 0 } : qi));
    processItem({ ...item, status: "pending" }, opts);
  };

  // Re-process a done item with current (possibly changed) opts
  const reprocessItem = (item: QueueItem) => {
    setQueue(q => q.map(qi => qi.id === item.id
      ? { ...qi, status: "pending", error: null, progress: 0, output: null, stats: null } : qi));
    processItem({ ...item, status: "pending", output: null, stats: null }, opts);
  };

  // Re-process ALL items (done + error + pending) with current opts
  const reprocessAll = () => {
    const items = queue.filter(q => q.status !== "processing");
    const reset  = items.map(qi => ({ ...qi, status: "pending" as const, error: null, progress: 0, output: null, stats: null }));
    setQueue(q => q.map(qi => {
      const r = reset.find(r => r.id === qi.id);
      return r ?? qi;
    }));
    // Run the first batch immediately
    const batch = reset.slice(0, MAX_CONCURRENT);
    batch.forEach(item => processItem(item, opts));
  };

  // Download one
  const downloadItem = (item: QueueItem) => {
    if (!item.output) return;
    const ext = opts.format === "jpeg" ? "jpg" : opts.format;
    const filename = `${item.file.name.replace(/\.[^.]+$/, "")}-resized.${ext}`;
    const a = document.createElement("a");
    a.href = item.output;
    a.download = filename;
    a.click();
    toast.success("Download started", {
      description: filename,
      icon: "⬇",
    });
  };

  // Download all done
  const downloadAll = () => {
    const done = queue.filter(q => q.status === "done" && q.output);
    if (done.length === 0) return;
    done.forEach((item, i) => setTimeout(() => {
      const ext = opts.format === "jpeg" ? "jpg" : opts.format;
      const a = document.createElement("a");
      a.href = item.output!;
      a.download = `${item.file.name.replace(/\.[^.]+$/, "")}-resized.${ext}`;
      a.click();
    }, i * 200));
    toast.success(`Downloading ${done.length} image${done.length > 1 ? "s" : ""}`, {
      description: `All saved as ${opts.format.toUpperCase()}`,
      icon: "📦",
    });
  };

  // Unit helpers
  const changeUnit = useCallback((newUnit: Unit) => {
    setUnit(newUnit);
    const pxW = parseInt(opts.width) || origW.current;
    const pxH = parseInt(opts.height) || origH.current;
    setDispW(fromPixels(pxW, newUnit, dpi, origW.current));
    setDispH(fromPixels(pxH, newUnit, dpi, origH.current));
  }, [opts.width, opts.height, dpi]);

  const changeDpi = useCallback((newDpi: number) => {
    setDpi(newDpi);
    const pxW = parseInt(opts.width) || origW.current;
    const pxH = parseInt(opts.height) || origH.current;
    setDispW(fromPixels(pxW, unit, newDpi, origW.current));
    setDispH(fromPixels(pxH, unit, newDpi, origH.current));
  }, [opts.width, opts.height, unit]);

  const onWidth = (v: string) => {
    setDispW(v);
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return;
    const px = toPixels(n, unit, dpi, origW.current);
    set("width", String(px));
    if (opts.lockAspect) {
      // Keep locked ratio
      const hPx = Math.round(px / aspectRatio.current);
      set("height", String(hPx));
      setDispH(fromPixels(hPx, unit, dpi, origH.current));
    } else {
      // Unlocked: track the new ratio so re-locking is sensible
      const curH = parseInt(opts.height) || origH.current;
      if (curH > 0) aspectRatio.current = px / curH;
    }
  };

  const onHeight = (v: string) => {
    setDispH(v);
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return;
    const px = toPixels(n, unit, dpi, origH.current);
    set("height", String(px));
    if (opts.lockAspect) {
      const wPx = Math.round(px * aspectRatio.current);
      set("width", String(wPx));
      setDispW(fromPixels(wPx, unit, dpi, origW.current));
    } else {
      const curW = parseInt(opts.width) || origW.current;
      if (curW > 0) aspectRatio.current = curW / px;
    }
  };

  // When locking: snap ratio from current dims + switch to "cover"
  // When unlocking: switch to "contain" so free dimensions don't crop/distort
  const toggleLock = () => {
    const nowLocked = opts.lockAspect;
    if (!nowLocked) {
      // Going unlocked → locked: recalculate ratio from current W/H + cover mode
      const curW = parseInt(opts.width)  || origW.current;
      const curH = parseInt(opts.height) || origH.current;
      if (curW > 0 && curH > 0) aspectRatio.current = curW / curH;
      setOpts(o => ({ ...o, lockAspect: true,  fit: "cover"   }));
    } else {
      // Going locked → unlocked: contain mode prevents distortion
      setOpts(o => ({ ...o, lockAspect: false, fit: "contain" }));
    }
  };

  // ── CSS layout values ──
  const sidebarW = isMobile ? "100%" : isTablet ? "320px" : "380px";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="sr-root">
      <style>{`
        .sr-root { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font-sans, 'DM Sans', sans-serif); transition: background .22s ease, color .22s ease; }

        /* Layout */
        .sr-layout { display: grid; grid-template-columns: ${sidebarW} 1fr; gap: 20px; padding: 20px; max-width: 1400px; margin: 0 auto; align-items: start; }
        @media (max-width: 1023px) { .sr-layout { grid-template-columns: 1fr; } }

        /* Sidebar overlay on mobile */
        .sr-sidebar { display: flex; flex-direction: column; gap: 12px; }
        @media (max-width: 1023px) {
          .sr-sidebar {
            position: fixed; top: 56px; left: 0; right: 0; bottom: 0;
            background: var(--bg); z-index: 40; padding: 16px; overflow-y: auto;
            transform: translateX(${sideOpen ? "0" : "-100%"});
            transition: transform .25s ease;
          }
        }
        .sr-sidebar-inner { position: sticky; top: 76px; }
        @media (max-width: 1023px) { .sr-sidebar-inner { position: static; } }

        /* Queue list */
        .queue-list { display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; padding-right: 2px; }
        @media (max-width: 1023px) { .queue-list { max-height: none; } }

        /* Queue item */
        .qi { cursor: pointer; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); transition: all .15s ease; display: flex; align-items: center; gap: 10px; padding: 10px; }
        .qi:hover { border-color: var(--accent); background: var(--accent-dim); }
        .qi.active { border-color: var(--accent); background: var(--accent-dim); box-shadow: var(--glow-accent); }

        /* Animations */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        .anim-in { animation: fadeSlide .25s ease forwards; }

        /* Mobile nav toggle */
        .mob-toggle { display: none; }
        @media (max-width: 1023px) { .mob-toggle { display: flex; } }

        /* Stat grid */
        .stat-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
        @media (max-width: 640px) { .stat-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 400px) { .stat-grid { grid-template-columns: 1fr; } }

        .preset-wrap { display: flex; flex-wrap: wrap; gap: 5px; }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
        @media (max-width: 380px) { .g2, .g3 { grid-template-columns: 1fr; } }
        .fmt-list { display: flex; flex-direction: column; gap: 5px; }

        /* Drop zone active */
        .drop-active { border-color: var(--accent) !important; background: var(--accent-dim) !important; box-shadow: inset 0 0 60px var(--accent-dim), 0 0 20px var(--accent-dim) !important; }

        /* Btn glow */
        .btn-glow { transition: all .2s ease !important; }
        .btn-glow:hover { box-shadow: var(--glow-accent) !important; transform: scale(1.02); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, height: 56, display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between", background: "var(--nav-bg)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", transition: "background .22s ease" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="mob-toggle" onClick={() => setSideOpen(o => !o)}
            style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border2)", background: sideOpen ? "var(--accent-dim)" : "var(--surface2)", cursor: "pointer", color: sideOpen ? "var(--accent)" : "var(--text2)", fontSize: 16, alignItems: "center", justifyContent: "center", marginRight: 4, flexShrink: 0 }}>
            {sideOpen ? "✕" : "☰"}
          </button>
          <div style={{ width: 32, height: 32, borderRadius: 9, overflow: "hidden", flexShrink: 0, boxShadow: "0 0 14px rgba(74,108,247,0.25)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="SmartResize" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "var(--text)" }}>SmartResize</span>
        </div>

        {/* Queue summary pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {queue.length > 0 && <>
            {pendingCount    > 0 && <QPill c="var(--text2)" bg="var(--surface2)">{pendingCount} pending</QPill>}
            {processingItems > 0 && <QPill c="var(--accent)" bg="var(--accent-dim)"><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>◌</span> {processingItems} processing</QPill>}
            {doneCount       > 0 && <QPill c="#10B981" bg="rgba(16,185,129,0.08)">✓ {doneCount} done</QPill>}
            {errorCount      > 0 && <QPill c="#EF4444" bg="rgba(239,68,68,0.08)">⚠ {errorCount} error</QPill>}
            {totalSaved      > 0 && !isMobile && <QPill c="var(--accent2)" bg="rgba(124,58,237,0.08)">💾 {formatBytes(totalSaved)} saved</QPill>}
          </>}
          {queue.length === 0 && <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>No images loaded</span>}
        </div>

        {/* Right: home link + theme toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && (
            <a href="/" style={{ fontSize: 11, color: "var(--text3)", textDecoration: "none", fontFamily: "var(--font-mono)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >← Home</a>
          )}
          <ThemeToggle size={32} />
        </div>
      </nav>

      {/* ── LAYOUT ── */}
      <div className="sr-layout">

        {/* ═══════════ SIDEBAR ═══════════ */}
        <div className="sr-sidebar" onClick={e => { if (isTablet && e.target === e.currentTarget) setSideOpen(false); }}>
          <div className="sr-sidebar-inner">

            {/* ── Drop zone ── */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={dragging ? "drop-active" : ""}
              style={{ border: "2px dashed var(--border2)", borderRadius: 14, padding: queue.length ? "16px 18px" : "36px 24px", textAlign: "center", cursor: "pointer", background: "var(--surface)", transition: "all .2s ease" }}
            >
              <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              {queue.length === 0 ? (
                <>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>Drop images here</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 12 }}>or click to browse · multiple files supported</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    {["JPEG","PNG","WebP","AVIF","TIFF"].map(f => (
                      <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>{f}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span style={{ fontSize: 18 }}>➕</span>
                  <span style={{ fontSize: 13, color: "#00E5FF", fontWeight: 600 }}>Add more images</span>
                  <span style={{ fontSize: 11, color: "var(--text2)" }}>· drop or click</span>
                </div>
              )}
            </div>

            {/* ── Queue list ── */}
            {queue.length > 0 && (
              <div className="card">
                {/* Queue header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text2)" }}>
                    Queue · {queue.length} {queue.length === 1 ? "image" : "images"}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {doneCount > 0 && (
                      <button onClick={clearDone} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                        Clear done
                      </button>
                    )}
                    {doneCount > 1 && (
                      <button onClick={downloadAll} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6EE7B7", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                        ⬇ All
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="queue-list" style={{ padding: "10px 10px" }}>
                  {queue.map(item => (
                    <div key={item.id} className={`qi anim-in${selected === item.id ? " active" : ""}`} onClick={() => { setSelected(item.id); setComparePos(50); }}>
                      {/* Thumb */}
                      <div className="checker" style={{ width: 44, height: 44, borderRadius: 7, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{item.file.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--font-mono)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span>{formatBytes(item.file.size)}</span>
                          {item.meta && <span>{item.meta.width}×{item.meta.height}</span>}
                          {item.stats && <span style={{ color: "#10B981" }}>→ {formatBytes(item.stats.outputSize)}</span>}
                        </div>
                        {/* Progress bar */}
                        {item.status === "processing" && (
                          <div style={{ marginTop: 5, height: 2, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                            <div className="shimmer-bar" style={{ height: "100%", width: `${item.progress}%`, borderRadius: 2 }} />
                          </div>
                        )}
                        {item.error && <div style={{ fontSize: 9, color: "#FCA5A5", marginTop: 2 }} title={item.error}>⚠ {item.error.slice(0, 40)}</div>}
                      </div>

                      {/* Status / action */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <StatusBadge status={item.status} />
                        <div style={{ display: "flex", gap: 3 }}>
                          {item.status === "done" && (
                            <button onClick={e => { e.stopPropagation(); downloadItem(item); }}
                              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7", cursor: "pointer" }}>⬇</button>
                          )}
                          {item.status === "done" && (
                            <button onClick={e => { e.stopPropagation(); reprocessItem(item); }}
                              title="Resize again with current settings"
                              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer" }}>↺</button>
                          )}
                          {item.status === "pending" && (
                            <button onClick={e => { e.stopPropagation(); handleProcessOne(item); }}
                              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", color: "#00E5FF", cursor: "pointer" }}>▶</button>
                          )}
                          {item.status === "error" && (
                            <button onClick={e => { e.stopPropagation(); retryItem(item); }}
                              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D", cursor: "pointer" }}>↺</button>
                          )}
                          <button onClick={e => { e.stopPropagation(); removeItem(item.id); }}
                            style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--input-bg)", border: "1px solid var(--border2)", color: "var(--text3)", cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Concurrent indicator */}
                {processingItems > 0 && (
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      {Array.from({ length: MAX_CONCURRENT }).map((_, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < processingItems ? "#00E5FF" : "var(--border2)", animation: i < processingItems ? "pulse 1s ease-in-out infinite" : "none", animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(0,229,255,0.7)", fontFamily: "var(--font-mono)" }}>{processingItems}/{MAX_CONCURRENT} slots active</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Settings panel ── */}
            {queue.length > 0 && (
              <div className="card">
                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                  {(["resize","enhance","output"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "11px 0", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.07em", background: "none", border: "none", cursor: "pointer", transition: "all .18s", color: activeTab === tab ? "#00E5FF" : "var(--text3)", borderBottom: `2px solid ${activeTab === tab ? "#00E5FF" : "transparent"}` }}>{tab}</button>
                  ))}
                </div>

                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* ─ RESIZE ─ */}
                  {activeTab === "resize" && <>

                    {/* Scale shortcuts */}
                    <Sec label="Scale Shortcuts">
                      <div className="preset-wrap">
                        {SCALE_SHORTCUTS.map(s => (
                          <PresetBtn key={s.label} label={s.label} onClick={() => {
                            if (!origW.current) return;
                            const nw = Math.round(origW.current * s.pct);
                            const nh = Math.round(origH.current * s.pct);
                            set("width", String(nw)); set("height", String(nh));
                            setDispW(fromPixels(nw, unit, dpi, origW.current));
                            setDispH(fromPixels(nh, unit, dpi, origH.current));
                          }} />
                        ))}
                        <PresetBtn label="Original" onClick={() => {
                          if (!origW.current) return;
                          set("width", String(origW.current)); set("height", String(origH.current));
                          setDispW(fromPixels(origW.current, unit, dpi, origW.current));
                          setDispH(fromPixels(origH.current, unit, dpi, origH.current));
                        }} />
                      </div>
                    </Sec>

                    {/* Preset sizes */}
                    <Sec label="Size Presets">
                      <div className="preset-wrap">
                        {PRESETS.map(p => (
                          <PresetBtn key={p.label} label={p.label} onClick={() => {
                            set("width", String(p.w)); set("height", String(p.h));
                            setDispW(fromPixels(p.w, unit, dpi, origW.current));
                            setDispH(fromPixels(p.h, unit, dpi, origH.current));
                          }} />
                        ))}
                      </div>
                    </Sec>

                    {/* Aspect ratio presets */}
                    <Sec label="Aspect Ratio">
                      <div className="preset-wrap">
                        {ASPECT_RATIOS.map(ar => (
                          <button key={ar.label}
                            onClick={() => {
                              if (ar.ratio === null) {
                                // "Free" — unlock and switch to contain
                                setOpts(o => ({ ...o, lockAspect: false, fit: "contain" }));
                                return;
                              }
                              // Named ratio — lock and switch to cover
                              aspectRatio.current = ar.ratio;
                              setOpts(o => ({ ...o, lockAspect: true, fit: "cover" }));
                              if (opts.width) {
                                const pw = parseInt(opts.width);
                                const ph = Math.round(pw / ar.ratio);
                                set("height", String(ph));
                                setDispH(fromPixels(ph, unit, dpi, origH.current));
                              }
                            }}
                            style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "var(--input-bg)", border: "1px solid var(--border2)", color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 600, transition: "all .15s" }}
                            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor="rgba(124,58,237,0.5)"; el.style.color="#c084fc"; el.style.background="rgba(124,58,237,0.08)"; }}
                            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor="var(--border2)"; el.style.color="var(--text2)"; el.style.background="var(--input-bg)"; }}
                          >{ar.label}</button>
                        ))}
                      </div>
                    </Sec>

                    {/* Dimensions with units */}
                    <Sec label="Dimensions">
                      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                        {UNITS.map(u => (
                          <button key={u.value} onClick={() => changeUnit(u.value)} title={u.desc}
                            style={{ flex: 1, padding: "5px 2px", borderRadius: 7, fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, cursor: "pointer", border: `1px solid ${unit === u.value ? "rgba(0,229,255,0.5)" : "var(--border2)"}`, background: unit === u.value ? "rgba(0,229,255,0.1)" : "var(--surface)", color: unit === u.value ? "#00E5FF" : "var(--text2)", transition: "all .15s" }}>
                            {u.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <NumIn label={`W (${unit})`} value={dispW} onChange={onWidth} step={unit === "px" ? 1 : 0.1} />
                        <button onClick={toggleLock}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${opts.lockAspect ? "rgba(0,229,255,0.45)" : "rgba(255,255,255,0.1)"}`, background: opts.lockAspect ? "rgba(0,229,255,0.09)" : "var(--surface)", cursor: "pointer", fontSize: 13, flexShrink: 0, marginBottom: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s", color: opts.lockAspect ? "#00E5FF" : "var(--text3)" }}>
                          {opts.lockAspect ? "🔒" : "🔓"}
                        </button>
                        <NumIn label={`H (${unit})`} value={dispH} onChange={onHeight} step={unit === "px" ? 1 : 0.1} />
                      </div>
                      {/* DPI panel for physical units */}
                      {(unit === "cm" || unit === "mm" || unit === "in") && (
                        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "rgba(245,158,11,0.8)", textTransform: "uppercase", letterSpacing: "0.08em" }}>DPI · {dpi}</span>
                            <div style={{ display: "flex", gap: 3 }}>
                              {DPI_PRESETS.map(d => (
                                <button key={d} onClick={() => changeDpi(d)}
                                  style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)", fontWeight: 700, cursor: "pointer", border: `1px solid ${dpi === d ? "rgba(245,158,11,0.6)" : "var(--border2)"}`, background: dpi === d ? "rgba(245,158,11,0.15)" : "var(--surface)", color: dpi === d ? "#F59E0B" : "var(--text2)" }}>
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input type="range" min={36} max={600} step={1} value={dpi} onChange={e => changeDpi(parseInt(e.target.value))} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text3)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                            <span>Screen 72</span><span>Web 96</span><span>Print 300</span><span>Fine 600</span>
                          </div>
                        </div>
                      )}
                      {/* Pixel readout */}
                      {unit !== "px" && opts.width && opts.height && (
                        <div style={{ marginTop: 7, fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ color: "rgba(0,229,255,0.4)" }}>≡</span>
                          {opts.width} × {opts.height} px{(unit==="cm"||unit==="mm"||unit==="in") ? ` @ ${dpi} dpi` : ""}
                        </div>
                      )}
                    </Sec>

                    {/* Resize Mode */}
                    <Sec label="Resize Mode">
                      <div className="g2">
                        {FIT_MODES.map(f => <MBtn key={f.value} active={opts.fit===f.value} onClick={() => set("fit",f.value)} accent="#00E5FF" title={`${f.icon} ${f.label}`} sub={f.desc} />)}
                      </div>
                    </Sec>

                    {/* Background color for contain/fill */}
                    {(opts.fit === "contain" || opts.fit === "fill") && (
                      <Sec label="Background Color">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="color"
                            value={opts.bgColor.length === 7 ? opts.bgColor : "#ffffff"}
                            onChange={e => set("bgColor", e.target.value)}
                            style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid var(--border2)", background: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Letterbox fill</div>
                            <div style={{ fontSize: 10, color: "var(--text3)" }}>{opts.bgColor === "transparent" ? "Transparent (alpha)" : opts.bgColor}</div>
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                            {([
                              { label: "White", color: "#ffffff" },
                              { label: "Black", color: "#000000" },
                              { label: "Trans", color: "transparent" },
                            ] as const).map(({ label, color }) => (
                              <button key={color} onClick={() => set("bgColor", color)} title={label}
                                style={{
                                  width: 26, height: 26, borderRadius: 6, cursor: "pointer",
                                  background: color === "transparent"
                                    ? "repeating-conic-gradient(#888 0% 25%,#ccc 25% 50%) 0 0/10px 10px"
                                    : color,
                                  border: `2px solid ${opts.bgColor === color ? "#00E5FF" : "var(--border2)"}`,
                                  boxShadow: opts.bgColor === color ? "0 0 0 1px rgba(0,229,255,0.4)" : "none",
                                  transition: "all .15s",
                                }} />
                            ))}
                          </div>
                        </div>
                      </Sec>
                    )}

                    {/* Smart Focus */}
                    {opts.fit === "cover" && (
                      <Sec label="🧠 Smart Focus (AI Crop)">
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {SMART_POSITIONS.map(p => <MBtn key={p.value} active={opts.position===p.value} onClick={() => set("position",p.value)} accent="#7C3AED" title={p.label} sub={p.desc} horizontal />)}
                        </div>
                      </Sec>
                    )}

                    {/* Rotation */}
                    <Sec label="Rotation">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
                        {[0, 90, 180, 270].map(deg => (
                          <button key={deg} onClick={() => set("rotation", deg)}
                            style={{ padding: "9px 4px", borderRadius: 8, textAlign: "center", cursor: "pointer", border: `1px solid ${opts.rotation===deg ? "rgba(0,229,255,0.45)" : "var(--border)"}`, background: opts.rotation===deg ? "rgba(0,229,255,0.08)" : "var(--surface)", transition: "all .15s" }}>
                            <div style={{ fontSize: 16, marginBottom: 2 }}>{deg===0?"↑":deg===90?"→":deg===180?"↓":"←"}</div>
                            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: opts.rotation===deg ? "#00E5FF" : "var(--text3)" }}>{deg}°</div>
                          </button>
                        ))}
                      </div>
                    </Sec>

                    {/* Kernel */}
                    <Sec label="Resampling Kernel">
                      <div className="g3">
                        {KERNELS.map(k => <MBtn key={k.value} active={opts.kernel===k.value} onClick={() => set("kernel",k.value)} accent="#00E5FF" title={k.label} sub={k.desc} />)}
                      </div>
                    </Sec>

                    {/* Constraints */}
                    <Sec label="Constraints">
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <Tog label="Never upscale"   sub="Don't enlarge beyond original" checked={opts.withoutEnlargement} onChange={v => set("withoutEnlargement",v)} />
                        <Tog label="Never downscale" sub="Don't shrink below original"   checked={opts.withoutReduction}   onChange={v => set("withoutReduction",  v)} />
                      </div>
                    </Sec>
                  </>}

                  {/* ─ ENHANCE ─ */}
                  {activeTab === "enhance" && <>

                    {/* Brightness / Contrast / Saturation / Hue */}
                    <Sec label="Light & Color">
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <SliderRow
                          label="Brightness" value={opts.brightness} min={0.1} max={3} step={0.01}
                          display={`${Math.round((opts.brightness - 1) * 100) >= 0 ? "+" : ""}${Math.round((opts.brightness - 1) * 100)}%`}
                          onChange={v => set("brightness", v)}
                          onReset={() => set("brightness", 1.0)}
                          accent="#F59E0B"
                          neutral={1.0}
                        />
                        <SliderRow
                          label="Contrast" value={opts.contrast} min={0.1} max={3} step={0.01}
                          display={`${Math.round((opts.contrast - 1) * 100) >= 0 ? "+" : ""}${Math.round((opts.contrast - 1) * 100)}%`}
                          onChange={v => set("contrast", v)}
                          onReset={() => set("contrast", 1.0)}
                          accent="#EF4444"
                          neutral={1.0}
                        />
                        <SliderRow
                          label="Saturation" value={opts.saturation} min={0} max={3} step={0.01}
                          display={`${Math.round((opts.saturation - 1) * 100) >= 0 ? "+" : ""}${Math.round((opts.saturation - 1) * 100)}%`}
                          onChange={v => set("saturation", v)}
                          onReset={() => set("saturation", 1.0)}
                          accent="#10B981"
                          neutral={1.0}
                        />
                        <SliderRow
                          label="Hue Shift" value={opts.hue} min={-180} max={180} step={1}
                          display={`${opts.hue >= 0 ? "+" : ""}${opts.hue}°`}
                          onChange={v => set("hue", v)}
                          onReset={() => set("hue", 0)}
                          accent="#7C3AED"
                          neutral={0}
                        />
                      </div>
                    </Sec>

                    {/* Sharpen */}
                    <Sec label="Sharpening">
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Tog label="🔪 Smart Sharpen" sub="Unsharp mask — makes edges crisp" checked={opts.sharpen} onChange={v => set("sharpen",v)} accent="#00E5FF" />
                        {opts.sharpen && (
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)", display: "flex", flexDirection: "column", gap: 10 }}>
                            <SliderRow label="Sigma (radius)" value={opts.sharpenSigma} min={0.3} max={10} step={0.1}
                              display={opts.sharpenSigma.toFixed(1)} onChange={v => set("sharpenSigma",v)} onReset={() => set("sharpenSigma",1.2)} accent="#00E5FF" neutral={1.2} />
                            <SliderRow label="Flat areas" value={opts.sharpenFlat} min={0} max={10} step={0.1}
                              display={opts.sharpenFlat.toFixed(1)} onChange={v => set("sharpenFlat",v)} onReset={() => set("sharpenFlat",1.0)} accent="#00E5FF" neutral={1.0} />
                            <SliderRow label="Edge areas" value={opts.sharpenJagged} min={0} max={10} step={0.1}
                              display={opts.sharpenJagged.toFixed(1)} onChange={v => set("sharpenJagged",v)} onReset={() => set("sharpenJagged",2.0)} accent="#00E5FF" neutral={2.0} />
                          </div>
                        )}
                      </div>
                    </Sec>

                    {/* Blur */}
                    <Sec label="Blur">
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Tog label="💧 Gaussian Blur" sub="Smooth & soften the image" checked={opts.blur} onChange={v => set("blur",v)} accent="#6366F1" />
                        {opts.blur && (
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.18)" }}>
                            <SliderRow label="Blur radius" value={opts.blurSigma} min={0.3} max={40} step={0.1}
                              display={`σ ${opts.blurSigma.toFixed(1)}`} onChange={v => set("blurSigma",v)} onReset={() => set("blurSigma",2)} accent="#6366F1" neutral={2} />
                          </div>
                        )}
                      </div>
                    </Sec>

                    {/* Misc */}
                    <Sec label="Other">
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <Tog label="⬛ Grayscale"   sub="Convert to black & white"     checked={opts.grayscale} onChange={v => set("grayscale",v)} accent="#94A3B8" />
                        <Tog label="📊 Auto-Level"  sub="Normalise contrast & exposure" checked={opts.normalise} onChange={v => set("normalise", v)} accent="#F59E0B" />
                        <Tog label="🎨 Tint"        sub="Apply a color overlay"         checked={opts.tint}     onChange={v => set("tint",     v)} accent="#F472B6" />
                        {opts.tint && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.2)" }}>
                            <input type="color" value={opts.tintColor} onChange={e => set("tintColor", e.target.value)}
                              style={{ width: 36, height: 30, borderRadius: 6, border: "1px solid var(--border2)", background: "none", cursor: "pointer", padding: 2 }} />
                            <span style={{ fontSize: 11, color: "var(--text2)" }}>Tint color: <span style={{ fontFamily: "var(--font-mono)", color: "#F472B6" }}>{opts.tintColor}</span></span>
                          </div>
                        )}
                      </div>
                    </Sec>

                    {/* Flip */}
                    <Sec label="Flip / Mirror">
                      <div className="g2">
                        {[{key:"flipH",icon:"↔",label:"Horizontal"},{key:"flipV",icon:"↕",label:"Vertical"}].map(({key,icon,label}) => {
                          const on = opts[key as keyof ResizeOptions] as boolean;
                          return (
                            <button key={key} onClick={() => set(key as keyof ResizeOptions, !on as ResizeOptions[keyof ResizeOptions])}
                              style={{ padding: "14px 10px", borderRadius: 10, textAlign: "center", cursor: "pointer", background: on ? "rgba(0,229,255,0.07)" : "var(--surface)", border: `1px solid ${on ? "rgba(0,229,255,0.35)" : "var(--border)"}`, transition: "all .15s" }}>
                              <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: on ? "#00E5FF" : "var(--text2)" }}>{label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </Sec>

                    {/* Reset all */}
                    <button
                      onClick={() => setOpts(o => ({ ...o, brightness:1, contrast:1, saturation:1, hue:0, sharpen:false, sharpenSigma:1.2, sharpenFlat:1, sharpenJagged:2, blur:false, blurSigma:2, grayscale:false, normalise:false, tint:false, flipH:false, flipV:false }))}
                      style={{ padding: "8px 0", borderRadius: 9, fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text2)", cursor: "pointer", width: "100%", transition: "all .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(239,68,68,0.3)"; e.currentTarget.style.color="#FCA5A5"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.color="var(--text2)"; }}
                    >↺ Reset all enhancements</button>
                  </>}

                  {/* ─ OUTPUT ─ */}
                  {activeTab === "output" && <>
                    <Sec label="Format">
                      <div className="fmt-list">
                        {FORMATS.map(f => (
                          <button key={f.value} onClick={() => set("format",f.value)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", borderRadius: 10, cursor: "pointer", background: opts.format===f.value ? `${f.color}10` : "var(--surface)", border: `1px solid ${opts.format===f.value ? `${f.color}55` : "var(--border)"}`, transition: "all .15s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: f.color, flexShrink: 0, boxShadow: opts.format===f.value ? `0 0 8px ${f.color}` : "none", transition: "box-shadow .2s" }} />
                              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: opts.format===f.value ? f.color : "var(--text2)" }}>{f.label}</span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${f.color}18`, color: f.color }}>{f.badge}</span>
                          </button>
                        ))}
                      </div>
                    </Sec>

                    {opts.format !== "png" && (
                      <Sec label={`Quality — ${opts.quality}%`}>
                        <input type="range" min={1} max={100} step={1} value={opts.quality} onChange={e => set("quality",parseInt(e.target.value))} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, gap: 5 }}>
                          {[10,25,50,75,85,95,100].map(q => (
                            <button key={q} onClick={() => set("quality", q)}
                              style={{ flex: 1, padding: "4px 0", fontSize: 10, borderRadius: 5, fontFamily: "var(--font-mono)", fontWeight: 700, border: `1px solid ${opts.quality===q?"rgba(0,229,255,0.5)":"var(--border)"}`, background: opts.quality===q?"rgba(0,229,255,0.1)":"var(--surface)", color: opts.quality===q?"#00E5FF":"var(--text3)", cursor: "pointer" }}>
                              {q}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
                          <span>← Smaller file</span>
                          <span style={{ color: opts.quality<40?"#EF4444":opts.quality<70?"#F59E0B":opts.quality<90?"#10B981":"#00E5FF", fontWeight:700 }}>
                            {opts.quality<40?"● Low":opts.quality<70?"● Medium":opts.quality<90?"● High":opts.quality<100?"✦ Very High":"✦ Lossless"}
                          </span>
                          <span>Better quality →</span>
                        </div>
                      </Sec>
                    )}

                    <Sec label="Metadata">
                      <Tog label="🗑️ Strip Metadata" sub="Remove EXIF, GPS, copyright info" checked={opts.stripMeta} onChange={v => set("stripMeta",v)} accent="#EF4444" />
                    </Sec>
                  </>}
                </div>

                {/* ── Process / Re-process All button ── */}
                <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={handleProcessAll} disabled={pendingCount === 0 || processingItems > 0}
                    className="btn-glow"
                    style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, letterSpacing: "0.03em", background: (pendingCount === 0 || processingItems > 0) ? "var(--input-bg)" : "linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%)", color: (pendingCount === 0 || processingItems > 0) ? "var(--text3)" : "#fff", cursor: (pendingCount === 0 || processingItems > 0) ? "not-allowed" : "pointer", boxShadow: (pendingCount === 0 || processingItems > 0) ? "none" : "0 4px 24px rgba(0,229,255,0.2)" }}>
                    {processingItems > 0
                      ? `⏳ Processing ${processingItems}…`
                      : pendingCount > 0
                        ? `⚡ Process ${pendingCount} image${pendingCount > 1 ? "s" : ""}`
                        : "✓ All processed"}
                  </button>

                  {/* Re-process all button — shown when at least one item is done */}
                  {doneCount > 0 && processingItems === 0 && (
                    <button onClick={reprocessAll} className="btn-glow"
                      style={{ width: "100%", padding: "10px 0", borderRadius: 11, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer", transition: "all .2s" }}>
                      ↺ Re-process all with new settings
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ MAIN CONTENT ═══════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Empty state */}
          {queue.length === 0 && (
            <div style={{ borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", minHeight: 520, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? 28 : 52, textAlign: "center" }}>
              <div style={{ width: 80, height: 80, borderRadius: 22, overflow: "hidden", marginBottom: 24, boxShadow: "0 0 40px rgba(74,108,247,0.25), 0 8px 32px rgba(0,0,0,0.4)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="SmartResize" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", marginBottom: 12 }}>SmartResize</h1>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.75, maxWidth: 400, marginBottom: 32 }}>
                Drop images in the sidebar to begin. Supports <strong style={{ color: "#00E5FF" }}>batch processing</strong> up to {MAX_CONCURRENT} concurrent jobs.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {["🧠 AI Smart Crop","🔪 Unsharp Mask","📐 Aspect Lock","🌐 5 Formats","⚡ Batch Queue","🔒 Strip EXIF"].map(f => (
                  <span key={f} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.15)", color: "rgba(0,229,255,0.8)" }}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Selected item preview */}
          {selectedItem && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }} key={selectedItem.id}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{selectedItem.file.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
                    {selectedItem.meta ? `${selectedItem.meta.width}×${selectedItem.meta.height} · ` : ""}{formatBytes(selectedItem.file.size)} · {selectedItem.file.type.split("/")[1]?.toUpperCase()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedItem.status === "pending" && (
                    <button onClick={() => handleProcessOne(selectedItem)} className="btn-glow"
                      style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", boxShadow: "0 4px 16px rgba(0,229,255,0.2)" }}>
                      ▶ Process this
                    </button>
                  )}
                  {selectedItem.status === "done" && (
                    <>
                      <button onClick={() => reprocessItem(selectedItem)} className="btn-glow"
                        title="Change dimensions/settings above then click to re-resize"
                        style={{ padding: "8px 18px", borderRadius: 9, border: "1px solid var(--accent)", cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "var(--accent-dim)", color: "var(--accent)", transition: "all .2s" }}>
                        ↺ Resize Again
                      </button>
                      <button onClick={() => downloadItem(selectedItem)} className="btn-glow"
                        style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.2)" }}>
                        ⬇ Download
                      </button>
                    </>
                  )}
                  {selectedItem.status === "error" && (
                    <button onClick={() => retryItem(selectedItem)} className="btn-glow"
                      style={{ padding: "8px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
                      ↺ Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Stats row (after processing) */}
              {selectedItem.stats && (
                <>
                  <div className="stat-grid">
                    {[
                      { label: "Original",   val: formatBytes(selectedItem.stats.originalSize),  sub: `${selectedItem.stats.originalWidth}×${selectedItem.stats.originalHeight}`, color: "var(--text2)" },
                      { label: "Output",     val: formatBytes(selectedItem.stats.outputSize),     sub: `${selectedItem.stats.outputWidth}×${selectedItem.stats.outputHeight}`,     color: selectedItem.stats.outputSize < selectedItem.stats.originalSize ? "#10B981" : "#F59E0B" },
                      { label: "Saved",      val: `${Math.abs(selectedItem.stats.compression)}%`, sub: selectedItem.stats.compression > 0 ? "smaller" : "larger",                 color: selectedItem.stats.compression > 0 ? "#10B981" : "#EF4444" },
                      { label: "Format",     val: selectedItem.stats.format.toUpperCase(),         sub: selectedItem.stats.hasAlpha ? "has alpha" : "no alpha",                    color: "var(--accent2)" },
                      { label: "Dimensions", val: `${selectedItem.stats.outputWidth}×${selectedItem.stats.outputHeight}`, sub: "pixels",                                          color: "var(--accent)" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono)", color: s.color, marginBottom: 2 }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  {/* Hint for re-resizing */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--accent-dim)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <span>Change dimensions or settings in the sidebar, then click <strong>↺ Resize Again</strong> to re-process.</span>
                  </div>
                </>
              )}

              {/* Processing state */}
              {selectedItem.status === "processing" && (
                <div style={{ borderRadius: 16, border: "1px solid rgba(0,229,255,0.15)", background: "rgba(0,229,255,0.04)", padding: "28px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1.5s linear infinite", display: "inline-block" }}>◌</div>
                  <div style={{ fontSize: 13, color: "#00E5FF", fontWeight: 600, marginBottom: 10 }}>Processing…</div>
                  <div style={{ width: "60%", margin: "0 auto", height: 3, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                    <div className="shimmer-bar" style={{ height: "100%", width: `${selectedItem.progress}%`, borderRadius: 3 }} />
                  </div>
                </div>
              )}

              {/* Error state */}
              {selectedItem.status === "error" && (
                <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FCA5A5", marginBottom: 4 }}>⚠ Processing failed</div>
                  <div style={{ fontSize: 12, color: "rgba(239,68,68,0.7)" }}>{selectedItem.error}</div>
                </div>
              )}

              {/* Before/After comparison */}
              {selectedItem.status === "done" && selectedItem.output && (
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text2)" }}>Before / After</span>
                      <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: 10, fontFamily: "var(--font-mono)" }}>← drag to compare →</span>
                    </div>
                    <button onClick={() => downloadItem(selectedItem)} className="btn-glow"
                      style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, background: "linear-gradient(135deg,#00E5FF,#7C3AED)", color: "#fff", boxShadow: "0 4px 16px rgba(0,229,255,0.2)" }}>
                      ⬇ Download
                    </button>
                  </div>
                  <CompareSlider
                    key={selectedItem.output}
                    before={selectedItem.previewUrl}
                    after={selectedItem.output}
                    height={isMobile ? 260 : 420}
                  />
                </div>
              )}

              {/* Pending preview */}
              {selectedItem.status === "pending" && (
                <div className="card">
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>Preview</span>
                  </div>
                  <div className="checker" style={{ minHeight: isMobile ? 200 : 360, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedItem.previewUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: isMobile ? 220 : 480, objectFit: "contain", borderRadius: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Export with Suspense (required for useSearchParams) ──────────────────────
export default function ResizerPage() {
  return (
    <Suspense>
      <ResizerPageInner />
    </Suspense>
  );
}

// ─── Mini components ──────────────────────────────────────────────────────────

function QPill({ children, c, bg }: { children: React.ReactNode; c: string; bg: string }) {
  return <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, padding: "3px 9px", borderRadius: 6, color: c, background: bg, display: "inline-flex", alignItems: "center", gap: 4 }}>{children}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string; bg: string }> = {
    pending:    { label: "Pending",    color: "var(--text2)", bg: "var(--surface2)" },
    processing: { label: "Working…",  color: "#00E5FF",               bg: "rgba(0,229,255,0.08)" },
    done:       { label: "Done",      color: "#10B981",               bg: "rgba(16,185,129,0.08)" },
    error:      { label: "Error",     color: "#EF4444",               bg: "rgba(239,68,68,0.08)" },
  };
  const s = map[status];
  return <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, color: s.color, background: s.bg, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>;
}

function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function PresetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: "var(--input-bg)", border: "1px solid var(--border2)", color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all .15s" }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor="rgba(0,229,255,0.45)"; el.style.color="#00E5FF"; el.style.background="rgba(0,229,255,0.07)"; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor="var(--border2)"; el.style.color="var(--text2)"; el.style.background="var(--input-bg)"; }}
    >{label}</button>
  );
}

function MBtn({ active, onClick, accent, title, sub, horizontal }: { active: boolean; onClick: () => void; accent: string; title: string; sub: string; horizontal?: boolean }) {
  return (
    <button onClick={onClick} style={{ padding: horizontal ? "8px 11px" : "8px 9px", borderRadius: 8, textAlign: horizontal ? "left" : "center", cursor: "pointer", transition: "all .15s", background: active ? `${accent}0D` : "var(--surface)", border: `1px solid ${active ? `${accent}45` : "var(--border)"}`, display: horizontal ? "flex" : "block", justifyContent: horizontal ? "space-between" : undefined, alignItems: horizontal ? "center" : undefined, gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: active ? accent : "var(--text2)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ fontSize: 9, color: "var(--text3)", marginTop: horizontal ? 0 : 2, lineHeight: 1.3 }}>{sub}</div>
    </button>
  );
}

function NumIn({ label, value, onChange, step = 1 }: { label: string; value: string; onChange: (v: string) => void; step?: number }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>{label}</div>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} min={0.01} step={step} placeholder="auto"
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-mono)", background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "#fff", outline: "none", transition: "border-color .18s" }}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e  => (e.target.style.borderColor = "var(--input-border)")}
      />
    </div>
  );
}

function Tog({ label, sub, checked, onChange, accent = "#00E5FF" }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 10, width: "100%", background: checked ? `${accent}0C` : "var(--surface)", border: `1px solid ${checked ? `${accent}42` : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all .18s" }}>
      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? accent : "var(--surface2)", flexShrink: 0, position: "relative", transition: "background .2s", border: `1px solid ${checked ? "transparent" : "var(--border)"}` }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: checked ? "#fff" : "var(--text2)" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );
}

// ─── SliderRow — labeled slider with reset button ────────────────────────────
function SliderRow({ label, value, min, max, step, display, onChange, onReset, accent, neutral }: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void; onReset: () => void;
  accent: string; neutral: number;
}) {
  const changed = Math.abs(value - neutral) > step * 0.5;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text2)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: changed ? accent : "var(--text3)" }}>{display}</span>
          {changed && (
            <button onClick={onReset} title="Reset to default"
              style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${accent}18`, border: `1px solid ${accent}35`, color: accent, cursor: "pointer", fontFamily: "var(--font-mono)", fontWeight: 700 }}>↺</button>
          )}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: accent }} />
        {/* Neutral tick mark */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `${((neutral - min) / (max - min)) * 100}%`,
          width: 2, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 1,
          pointerEvents: "none", marginLeft: -1,
        }} />
      </div>
    </div>
  );
}

// ─── CompareSlider ────────────────────────────────────────────────────────────
// Aligns the divider to the actual rendered image content (object-fit:contain),
// so the clip never bleeds outside the image even when BEFORE and AFTER have
// different aspect ratios.
function CompareSlider({ before, after, height }: { before: string; after: string; height: number }) {
  const [pos,      setPos]      = useState(50);
  const [dragging, setDragging] = useState(false);
  // Actual image content rect within the container (px, relative to container)
  const [imgBox, setImgBox] = useState<{ x: number; w: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeImgRef = useRef<HTMLImageElement>(null);

  // Compute where the BEFORE image actually renders (object-fit:contain math)
  const measure = useCallback(() => {
    const img = beforeImgRef.current;
    const con = containerRef.current;
    if (!img?.naturalWidth || !con) return;
    const cW = con.clientWidth;
    const cH = con.clientHeight;
    const scale = Math.min(cW / img.naturalWidth, cH / img.naturalHeight);
    const rW = img.naturalWidth  * scale;
    const rX = (cW - rW) / 2;
    setImgBox({ x: rX, w: rW });
  }, []);

  // Re-measure on image load and window resize
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // ─ Pointer logic ─
  const getPos = useCallback((clientX: number) => {
    const conRect = containerRef.current?.getBoundingClientRect();
    if (!conRect || !imgBox) {
      // Fallback: pos = % of full container width
      if (!conRect) return 50;
      return Math.min(100, Math.max(0, ((clientX - conRect.left) / conRect.width) * 100));
    }
    // Pos = % of IMAGE width, clamped 0–100
    const imgLeft  = conRect.left + imgBox.x;
    const imgRight = imgLeft + imgBox.w;
    const clamped  = Math.min(imgRight, Math.max(imgLeft, clientX));
    return ((clamped - imgLeft) / imgBox.w) * 100;
  }, [imgBox]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(getPos(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPos(getPos(e.clientX));
  };
  const onPointerUp = () => setDragging(false);

  // Convert slider pos → left px within container
  const handleX = imgBox
    ? imgBox.x + (pos / 100) * imgBox.w
    : (pos / 100) * (containerRef.current?.clientWidth ?? 0);

  // Clip AFTER to left of divider using px values so it aligns to image content
  const clip = imgBox
    ? `polygon(0 0, ${handleX}px 0, ${handleX}px 100%, 0 100%)`
    : `inset(0 ${100 - pos}% 0 0)`;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative", width: "100%", height,
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "ew-resize",
        userSelect: "none", touchAction: "none",
        backgroundImage: "repeating-conic-gradient(var(--check-a,#1a1a24) 0% 25%, var(--check-b,#141420) 25% 50%)",
        backgroundSize: "18px 18px",
      }}
    >
      {/* BEFORE — full contain, used to measure image rect */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={beforeImgRef}
        src={before}
        alt="before"
        draggable={false}
        onLoad={measure}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
      />

      {/* AFTER — same layout, clipped at divider */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="after"
        draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "contain", pointerEvents: "none",
          clipPath: clip,
          willChange: "clip-path",
        }}
      />

      {/* Divider — only shown once image rect is measured */}
      {imgBox && (
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: handleX, transform: "translateX(-50%)",
          width: 2, background: "rgba(255,255,255,0.92)",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
          zIndex: 10, pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: `translate(-50%,-50%) scale(${dragging ? 1.18 : 1})`,
            width: 36, height: 36, borderRadius: "50%",
            background: "#fff", boxShadow: "0 2px 16px rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 900, color: "#111", letterSpacing: "-1px",
            transition: "transform 0.15s ease",
          }}>◀▶</div>
        </div>
      )}

      {/* Corner labels */}
      <span style={{ position: "absolute", top: 12, left: 12, zIndex: 11, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 5, background: "rgba(0,0,0,0.65)", color: "var(--accent)", fontFamily: "var(--font-mono)", backdropFilter: "blur(6px)", border: "1px solid rgba(0,229,255,0.25)", pointerEvents: "none" }}>AFTER</span>
      <span style={{ position: "absolute", top: 12, right: 12, zIndex: 11, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 5, background: "rgba(0,0,0,0.65)", color: "var(--text3)", fontFamily: "var(--font-mono)", backdropFilter: "blur(6px)", border: "1px solid var(--border2)", pointerEvents: "none" }}>BEFORE</span>
    </div>
  );
}
