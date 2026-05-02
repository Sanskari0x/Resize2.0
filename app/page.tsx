"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fileBridge } from "./lib/fileBridge";
import { ThemeToggle } from "./components/ThemeProvider";
import { cn } from "./lib/utils";
import {
  Upload, Brain, Layers, Palette, Ruler, Shield, Globe,
  ArrowRight, Check, ChevronRight, Star, Sparkles,
  ImageIcon, BarChart3, Lock, Cpu, Download, Zap,
} from "lucide-react";

/* ── Scroll reveal ─────────────────────────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".rv");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("rv-in"); io.unobserve(e.target); }
      }),
      { threshold: 0.08, rootMargin: "0px 0px -36px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Animated counter ──────────────────────────────────────────────────────── */
function useCounter(target: number, dur = 1600) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, dur]);
  return { v, ref };
}

/* ── Data ──────────────────────────────────────────────────────────────────── */
const NAV = [
  { label: "Features",     href: "#features" },
  { label: "How it works", href: "#process"  },
  { label: "Pricing",      href: "#pricing"  },
  { label: "FAQ",          href: "#faq"      },
];

const STEPS = [
  { n: "01", Icon: Upload,   col: "#0EA5E9", bg: "rgba(14,165,233,.1)",  title: "Drop your image",      desc: "JPEG, PNG, WebP, AVIF or TIFF. Up to 50 MB. No account needed." },
  { n: "02", Icon: Cpu,      col: "#8B5CF6", bg: "rgba(139,92,246,.1)",  title: "Configure & enhance",  desc: "Dimensions in any unit, AI crop, 15+ colour & sharpness controls." },
  { n: "03", Icon: Download, col: "#10B981", bg: "rgba(16,185,129,.1)",  title: "Download instantly",   desc: "Drag the before/after slider, then download one or batch-download all." },
];

const FEATURES = [
  { Icon: Brain,   col: "#0EA5E9", bg: "rgba(14,165,233,.1)",  title: "AI Smart Crop",          desc: "Saliency detection finds faces & subjects before cropping — like Photoshop Content-Aware." },
  { Icon: Layers,  col: "#8B5CF6", bg: "rgba(139,92,246,.1)",  title: "Batch Queue",             desc: "50 images, 3 concurrent jobs, live progress bars, per-file controls." },
  { Icon: Palette, col: "#EC4899", bg: "rgba(236,72,153,.1)",  title: "Enhancement Suite",       desc: "Brightness, contrast, saturation, hue, sharpen, blur, tint & rotate." },
  { Icon: Ruler,   col: "#F59E0B", bg: "rgba(245,158,11,.1)",  title: "Every Unit Supported",    desc: "px · cm · mm · inches · % with DPI slider (72–600)." },
  { Icon: Shield,  col: "#10B981", bg: "rgba(16,185,129,.1)",  title: "Privacy-safe",            desc: "Strip EXIF/GPS with one toggle. Nothing stored server-side." },
  { Icon: Globe,   col: "#3B82F6", bg: "rgba(59,130,246,.1)",  title: "5 Output Formats",        desc: "JPEG (MozJPEG) · WebP · AVIF · PNG · TIFF — quality sliders for each." },
];

const FORMATS = ["JPEG", "PNG", "WebP", "AVIF", "TIFF", "GIF"];

const TESTIMONIALS = [
  { name: "Priya N.",   role: "Brand Manager",  stars: 5, text: "Batch-processed 200 product photos in 4 minutes. Replaced 3 separate tools for us." },
  { name: "Marcus L.",  role: "Frontend Dev",   stars: 5, text: "AI smart crop is genuinely impressive — knows exactly where to cut without losing the subject." },
  { name: "Aiko T.",    role: "Photographer",   stars: 5, text: "Finally a resize tool that respects print DPI. The cm/mm units with DPI slider saved my workflow." },
];

const FAQ_ITEMS = [
  { q: "Is it really free?",                   a: "Yes — no watermarks, no credits, no account. Drop and resize." },
  { q: "Are my images stored on a server?",    a: "No. Processing is server-side but streamed directly back. Nothing is persisted." },
  { q: "What's the file size limit?",          a: "50 MB per image. You can queue unlimited images simultaneously." },
  { q: "Can I resize multiple images at once?", a: "Yes — batch queue supports unlimited files, processing 3 concurrently." },
  { q: "What formats can I export?",           a: "JPEG (MozJPEG), WebP, AVIF, PNG, TIFF with full quality control per format." },
];

/* ── Typography primitives ─────────────────────────────────────────────────── */
function SectionLabel({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <p className="rv" style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: accent ? "var(--accent)" : "var(--text3)", marginBottom: 14 }}>
      {children}
    </p>
  );
}
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="rv d1" style={{ textAlign: "center", fontSize: "clamp(26px,4.5vw,52px)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.08, color: "var(--text-heading)", marginBottom: 14 }}>
      {children}
    </h2>
  );
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="rv d2" style={{ textAlign: "center", fontSize: "clamp(14px,1.6vw,17px)", color: "var(--text2)", maxWidth: 480, margin: "0 auto clamp(32px,4vw,56px)", lineHeight: 1.7, letterSpacing: "-.01em" }}>
      {children}
    </p>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router               = useRouter();
  const fileRef              = useRef<HTMLInputElement>(null);
  const [drag,     setDrag]  = useState(false);
  const [busy,     setBusy]  = useState(false);
  const [mOpen,    setMOpen] = useState(false);
  const [faq,      setFaq]   = useState<number | null>(null);
  const [scrolled, setScr]   = useState(false);
  useReveal();

  const s1 = useCounter(50000);
  const s2 = useCounter(99);
  const s3 = useCounter(500);

  useEffect(() => {
    const fn = () => setScr(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close mobile menu on scroll
  useEffect(() => {
    if (mOpen) setMOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolled]);

  const go = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    fileBridge.set(file);
    router.push("/resizer?fromLanding=1");
  }, [router]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) go(f);
  }, [go]);

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ══ Global page styles ══ */}
      <style>{`
        /* Reveal animations */
        .rv     { opacity:0; transform:translateY(20px); transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1); }
        .rv.rv-in { opacity:1; transform:none; }
        .rv.d1{transition-delay:.08s} .rv.d2{transition-delay:.16s} .rv.d3{transition-delay:.24s} .rv.d4{transition-delay:.32s}

        /* Marquee */
        .mq { display:flex; gap:52px; animation:marquee 24s linear infinite; width:max-content; align-items:center; }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        /* Text gradients */
        .gt  { background:linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .sit { font-family:var(--font-serif,'Georgia',serif); font-style:italic; background:linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

        /* Card hover */
        .hc { transition:transform .25s ease,box-shadow .25s ease,border-color .2s ease; }
        .hc:hover { transform:translateY(-5px); box-shadow:var(--shadow-lg) !important; border-color:var(--border2) !important; }

        /* Nav link */
        .nl { position:relative; text-decoration:none; font-size:14px; font-weight:500; color:var(--text2); transition:color .15s ease; padding:6px 12px; border-radius:8px; }
        .nl:hover { color:var(--text); background:var(--surface2); }

        /* Gradient button */
        .gb { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-weight:700; letter-spacing:-.01em; border:none; cursor:pointer; transition:all .2s ease; white-space:nowrap; text-decoration:none; }
        .gb:hover { opacity:.88; transform:translateY(-1.5px); box-shadow:0 8px 28px color-mix(in srgb,var(--accent) 35%,transparent); }
        .gb:active { transform:scale(.97); opacity:1; }
        .gb:disabled { opacity:.4; cursor:not-allowed; transform:none; box-shadow:none; }

        /* Outline button */
        .ob { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:transparent; color:var(--text); font-weight:600; border:1.5px solid var(--border2); cursor:pointer; transition:all .2s ease; text-decoration:none; white-space:nowrap; }
        .ob:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-dim); }

        /* Upload float */
        @keyframes flt { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .flt { animation:flt 3.5s ease-in-out infinite; }

        /* Drop zone */
        .dz { transition:all .2s ease; }
        .dz:hover, .dz.on { border-color:var(--accent) !important; background:var(--accent-dim) !important; box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 10%,transparent) !important; }

        /* Mobile menu */
        .mob-nav { position:fixed; inset:0; top:60px; background:var(--bg); z-index:45; padding:20px; display:flex; flex-direction:column; gap:4px; transform:translateX(-105%); transition:transform .3s cubic-bezier(.22,1,.36,1); border-right:1px solid var(--border); }
        .mob-nav.open { transform:translateX(0); }

        /* Stat band stays dark in both themes */
        .stat-band { background:#0E0D0B; }

        /* Spin */
        @keyframes spin { to{transform:rotate(360deg)} }

        /* FAQ open */
        .faq-item { transition:border-color .2s ease, box-shadow .2s ease; }
        .faq-item.open { border-color:var(--accent) !important; box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 14%,transparent); }
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) go(f); e.target.value = ""; }} />

      {/* ══════════════════ NAV ══════════════════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--nav-bg)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
        transition: "all .3s ease",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 clamp(16px,3vw,28px)", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.png" alt="SmartResize" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 15, letterSpacing: "-.03em", color: "var(--text-heading)" }}>
              SmartResize
            </span>
          </a>

          {/* Desktop nav */}
          <nav style={{ display: "flex", gap: 2, alignItems: "center" }} className="hide-sm">
            {NAV.map(l => <a key={l.label} href={l.href} className="nl">{l.label}</a>)}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <ThemeToggle size={34} />
            <a href="/resizer" className="gb hide-sm" style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13 }}>
              Open App <ArrowRight size={14} />
            </a>
            {/* Hamburger */}
            <button onClick={() => setMOpen(o => !o)} className="show-sm"
              style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid var(--border2)", background: mOpen ? "var(--accent-dim)" : "var(--surface2)", cursor: "pointer", color: mOpen ? "var(--accent)" : "var(--text2)", fontSize: 18, display: "none", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
              {mOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={cn("mob-nav", mOpen && "open")}>
          {NAV.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMOpen(false)}
              style={{ display: "block", padding: "15px 16px", borderRadius: 12, fontSize: 17, fontWeight: 600, color: "var(--text)", textDecoration: "none", letterSpacing: "-.02em", transition: "background .15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >{l.label}</a>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
          <a href="/resizer" className="gb" style={{ borderRadius: 13, padding: "15px 20px", fontSize: 15, width: "100%", marginTop: 4 }}>
            Open App <ArrowRight size={16} />
          </a>
        </div>
      </header>

      {/* Responsive show/hide utility */}
      <style>{`
        .hide-sm  { display:flex; }
        .show-sm  { display:none; }
        @media(max-width:700px) {
          .hide-sm { display:none !important; }
          .show-sm { display:flex !important; }
        }
      `}</style>

      {/* ══════════════════ HERO ══════════════════ */}
      <section style={{ padding: "clamp(72px,10vw,128px) clamp(16px,3vw,28px) clamp(52px,6vw,80px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Ambient */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 55% at 50% -5%, color-mix(in srgb,var(--accent) 9%,transparent), transparent)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize: "56px 56px", opacity: .35 }} />

        <div style={{ maxWidth: 840, margin: "0 auto", position: "relative" }}>

          {/* Eyebrow badge */}
          <div className="rv" style={{ display: "flex", justifyContent: "center", marginBottom: "clamp(20px,3vw,32px)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "5px 16px 5px 6px", borderRadius: 999, fontFamily: "var(--font-sans)" }}>
              <span style={{ background: "rgba(255,255,255,.2)", borderRadius: 999, padding: "2px 10px", fontSize: 11 }}>New ✦</span>
              <Sparkles size={12} style={{ opacity: .8 }} />
              AI Smart Crop is live
            </span>
          </div>

          {/* Headline — Inter black + Instrument Serif italic */}
          <h1 className="rv d1" style={{ fontSize: "clamp(40px,8vw,88px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-.045em", marginBottom: "clamp(16px,2vw,24px)", color: "var(--text-heading)" }}>
            Resize Images<br />Like{" "}
            <span className="sit">a Pro Designer</span>
          </h1>

          {/* Sub — Inter regular, optically sized */}
          <p className="rv d2" style={{ fontSize: "clamp(15px,2.2vw,19px)", lineHeight: 1.68, color: "var(--text2)", maxWidth: 520, margin: "0 auto clamp(28px,4vw,44px)", fontWeight: 400, letterSpacing: "-.01em" }}>
            Photoshop-quality resizing in your browser. AI-aware cropping,
            batch&nbsp;processing, 5&nbsp;formats, and 15+ enhancement
            tools — all&nbsp;free.
          </p>

          {/* CTAs */}
          <div className="rv d3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => fileRef.current?.click()} className="gb"
              style={{ padding: "clamp(12px,1.6vw,15px) clamp(24px,3vw,34px)", borderRadius: 14, fontSize: "clamp(13px,1.5vw,15px)" }}
              disabled={busy}>
              {busy
                ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite", display: "inline-block" }} />Loading…</>
                : <><Upload size={15} />Start resizing free</>}
            </button>
            <a href="/resizer" className="ob" style={{ padding: "clamp(12px,1.6vw,15px) clamp(24px,3vw,34px)", borderRadius: 14, fontSize: "clamp(13px,1.5vw,15px)" }}>
              Open App <ArrowRight size={14} />
            </a>
          </div>

          {/* Trust note — JetBrains Mono */}
          <p className="rv d4" style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)", letterSpacing: ".02em" }}>
            No sign-up · No watermarks · 50 MB · Files never stored
          </p>
        </div>
      </section>

      {/* ══════════════════ UPLOAD ZONE ══════════════════ */}
      <section style={{ padding: "0 clamp(16px,3vw,28px) clamp(52px,6vw,80px)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }} className="rv">
          <div className={cn("dz", drag && "on")}
            style={{ border: "2px dashed var(--border2)", borderRadius: 22, padding: "clamp(36px,5vw,60px) 24px", textAlign: "center", background: "var(--surface)", cursor: busy ? "wait" : "pointer", position: "relative", overflow: "hidden" }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => !busy && fileRef.current?.click()}
          >
            {/* Corner accents */}
            <div style={{ position: "absolute", top: 0, left: 0, width: 40, height: 40, opacity: .15, background: "repeating-conic-gradient(var(--border2) 0% 25%,transparent 25% 50%)", backgroundSize: "8px 8px" }} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 40, height: 40, opacity: .15, background: "repeating-conic-gradient(var(--border2) 0% 25%,transparent 25% 50%)", backgroundSize: "8px 8px" }} />

            {busy ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                <p style={{ fontWeight: 700, color: "var(--text)", fontSize: 15, letterSpacing: "-.01em" }}>Loading your image…</p>
              </div>
            ) : (
              <>
                <div className="flt" style={{ width: 62, height: 62, borderRadius: 19, margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,var(--accent),var(--accent2))", boxShadow: "var(--shadow-md)" }}>
                  <ImageIcon size={26} color="#fff" />
                </div>
                <h3 style={{ fontSize: "clamp(17px,2.5vw,21px)", fontWeight: 800, letterSpacing: "-.025em", color: "var(--text-heading)", marginBottom: 9 }}>
                  {drag ? "Release to upload" : "Drop your image here"}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20 }}>or click to browse files</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                  {FORMATS.map(f => (
                    <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 7, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)", letterSpacing: ".04em" }}>{f}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════ LOGO BAR ══════════════════ */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "22px 0 20px", overflow: "hidden" }}>
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 18 }}>Trusted by teams at</p>
        <div style={{ overflow: "hidden", maskImage: "linear-gradient(to right,transparent,white 14%,white 86%,transparent)" }}>
          <div className="mq">
            {["Logolipsum","IPSUM","NexCorp","LOCO","Vertax","Brandly","Logolipsum","IPSUM","NexCorp","LOCO","Vertax","Brandly"].map((n, i) => (
              <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "-.02em", color: "var(--text3)", whiteSpace: "nowrap" }}>{n}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ STATS (always dark band) ══════════════════ */}
      <div className="stat-band" style={{ padding: "clamp(44px,5vw,72px) clamp(16px,3vw,28px)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(16px,3vw,44px)", textAlign: "center" }}>
          {[
            { ref: s1.ref, v: s1.v, sfx: "K+",  label: "Images processed",   note: "and counting"            },
            { ref: s2.ref, v: s2.v, sfx: ".9%",  label: "Uptime SLA",         note: "reliable infrastructure" },
            { ref: s3.ref, v: s3.v, sfx: "+",    label: "Integrations",        note: "format & kernel options" },
          ].map((s, i) => (
            <div key={i} ref={s.ref}>
              <div className="gt" style={{ fontSize: "clamp(38px,6vw,66px)", fontWeight: 900, letterSpacing: "-.045em", fontFamily: "var(--font-sans)", lineHeight: 1 }}>
                {s.v}{s.sfx}
              </div>
              <div style={{ fontSize: "clamp(13px,1.5vw,15px)", fontWeight: 700, color: "#fff", marginTop: 6, marginBottom: 3, letterSpacing: "-.01em" }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)", fontFamily: "var(--font-mono)" }}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="process" style={{ padding: "clamp(60px,7vw,104px) clamp(16px,3vw,28px)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel accent>Process</SectionLabel>
          <SectionHeading>Up and running in <span className="sit">60 seconds</span></SectionHeading>
          <SectionSub>No onboarding call. No setup wizard. Drop an image and go.</SectionSub>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,268px),1fr))", gap: 16, marginBottom: 44 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} className={cn("rv hc", `d${i + 1}`)}
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 22, padding: "clamp(24px,3vw,36px)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: s.bg, border: `1px solid ${s.col}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                  <s.Icon size={22} color={s.col} />
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 9 }}>Step {s.n}</p>
                <h3 style={{ fontSize: "clamp(16px,1.8vw,20px)", fontWeight: 800, letterSpacing: "-.025em", color: "var(--text-heading)", marginBottom: 11, lineHeight: 1.2 }}>{s.title}</h3>
                <p style={{ fontSize: "clamp(13px,1.3vw,14px)", color: "var(--text2)", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }} className="rv">
            <button onClick={() => fileRef.current?.click()} className="gb" style={{ padding: "13px 32px", borderRadius: 14, fontSize: 14 }}>
              <Upload size={15} /> Try it now — free
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" style={{ padding: "clamp(60px,7vw,104px) clamp(16px,3vw,28px)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel accent>Features</SectionLabel>
          <SectionHeading>Everything you need.<br /><span className="sit">Nothing you don&apos;t.</span></SectionHeading>
          <SectionSub>A complete image editing pipeline — without the software subscription.</SectionSub>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,294px),1fr))", gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={cn("rv hc", `d${(i % 3) + 1}`)}
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 19, padding: "clamp(20px,2.5vw,28px)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: f.bg, border: `1px solid ${f.col}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <f.Icon size={19} color={f.col} />
                </div>
                <div>
                  <h3 style={{ fontSize: "clamp(14px,1.5vw,16px)", fontWeight: 800, letterSpacing: "-.022em", color: "var(--text-heading)", marginBottom: 6, lineHeight: 1.25 }}>{f.title}</h3>
                  <p style={{ fontSize: "clamp(12px,1.2vw,13px)", color: "var(--text2)", lineHeight: 1.7 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ TESTIMONIALS ══════════════════ */}
      <section style={{ padding: "clamp(60px,7vw,104px) clamp(16px,3vw,28px)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel>Reviews</SectionLabel>
          <SectionHeading>Loved by creators worldwide</SectionHeading>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,278px),1fr))", gap: 14 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={cn("rv hc", `d${i + 1}`)}
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 19, padding: "clamp(20px,2.5vw,28px)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={14} fill="#F59E0B" color="#F59E0B" />)}
                </div>
                <p style={{ fontSize: "clamp(13px,1.3vw,14px)", color: "var(--text2)", lineHeight: 1.72, flex: 1 }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ height: 1, background: "var(--border)" }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", letterSpacing: "-.015em" }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ PRICING ══════════════════ */}
      <section id="pricing" style={{ padding: "clamp(60px,7vw,104px) clamp(16px,3vw,28px)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <SectionLabel>Pricing</SectionLabel>
          <SectionHeading>Free to start,<br /><span className="sit">powerful to scale</span></SectionHeading>
          <SectionSub>No credits, no watermarks, no account needed.</SectionSub>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,268px),1fr))", gap: 14, textAlign: "left" }}>
            {[
              { plan: "Free", price: "$0", per: "forever",  desc: "Everything, no strings attached.", primary: false, features: ["Unlimited resizes","All 5 output formats","AI Smart Crop","Batch queue (3 concurrent)","EXIF strip & privacy tools"], cta: "Start now", href: "/resizer" },
              { plan: "Pro",  price: "$9", per: "/ month",  desc: "API access, priority queue & more.", primary: true,  features: ["Everything in Free","REST API access","10 concurrent jobs","Priority processing","Dedicated support"],            cta: "Coming soon", href: "#" },
            ].map(p => (
              <div key={p.plan} style={{ background: "var(--card-bg)", border: `1px solid ${p.primary ? "var(--accent)" : "var(--border)"}`, borderRadius: 22, overflow: "hidden", boxShadow: p.primary ? "var(--shadow-md),0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)" : "var(--shadow-sm)" }}>
                {p.primary && <div style={{ height: 3, background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />}
                <div style={{ padding: "clamp(22px,3vw,30px)" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 12 }}>{p.plan}</p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: 900, letterSpacing: "-.045em", color: "var(--text-heading)", lineHeight: 1 }}>{p.price}</span>
                    <span style={{ fontSize: 13, color: "var(--text3)", marginBottom: 7 }}>{p.per}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 22, lineHeight: 1.6 }}>{p.desc}</p>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text2)" }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={10} color="var(--accent)" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.primary
                    ? <button disabled className="gb" style={{ width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14, opacity: .45 }}>{p.cta}</button>
                    : <a href={p.href} className="gb" style={{ width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14 }}>{p.cta}</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FAQ ══════════════════ */}
      <section id="faq" style={{ padding: "clamp(60px,7vw,104px) clamp(16px,3vw,28px)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <SectionLabel>FAQ</SectionLabel>
          <SectionHeading>Common questions</SectionHeading>
          <div className="rv d2" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={cn("faq-item", faq === i && "open")}
                onClick={() => setFaq(faq === i ? null : i)}
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(15px,2vw,19px) clamp(18px,2.5vw,22px)", gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: "clamp(13px,1.5vw,15px)", color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1.3 }}>{item.q}</span>
                  <ChevronRight size={15} style={{ color: "var(--text3)", transform: faq === i ? "rotate(90deg)" : "none", transition: "transform .2s ease", flexShrink: 0 }} />
                </div>
                {faq === i && (
                  <p style={{ padding: "0 clamp(18px,2.5vw,22px) clamp(15px,2vw,19px)", fontSize: "clamp(13px,1.4vw,14px)", color: "var(--text2)", lineHeight: 1.7 }}>{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ BIG CTA ══════════════════ */}
      <section style={{ padding: "clamp(32px,4vw,56px) clamp(16px,3vw,28px) clamp(60px,7vw,104px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }} className="rv">
          <div style={{ borderRadius: "clamp(22px,3vw,36px)", padding: "clamp(48px,6vw,88px) clamp(24px,5vw,72px)", textAlign: "center", background: "#0E0D0B", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 65% 65% at 20% 50%,color-mix(in srgb,var(--accent) 14%,transparent),transparent),radial-gradient(ellipse 65% 65% at 80% 50%,color-mix(in srgb,var(--accent2) 14%,transparent),transparent)" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "5px 16px", marginBottom: "clamp(20px,2.5vw,30px)" }}>
                <BarChart3 size={13} color="#fff" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.8)", fontFamily: "var(--font-mono)", letterSpacing: ".04em" }}>50,000+ images resized this month</span>
              </div>
              <h2 style={{ fontSize: "clamp(30px,5.5vw,62px)", fontWeight: 900, letterSpacing: "-.045em", color: "#fff", marginBottom: "clamp(14px,1.8vw,20px)", lineHeight: 1.04 }}>
                Start resizing<br />
                <span style={{ fontFamily: "var(--font-serif,'Georgia',serif)", fontStyle: "italic", color: "rgba(255,255,255,.65)" }}>in seconds</span>
              </h2>
              <p style={{ fontSize: "clamp(14px,1.8vw,17px)", color: "rgba(255,255,255,.45)", marginBottom: "clamp(28px,3.5vw,44px)", maxWidth: 400, margin: "0 auto clamp(28px,3.5vw,44px)", lineHeight: 1.65 }}>
                No sign-up. No limits. Drop an image and see the quality difference.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#fff", color: "#0E0D0B", fontWeight: 800, fontSize: "clamp(13px,1.5vw,15px)", padding: "clamp(13px,1.6vw,16px) clamp(24px,3vw,36px)", borderRadius: 14, border: "none", cursor: "pointer", letterSpacing: "-.015em", transition: "all .2s", fontFamily: "var(--font-sans)" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                  <Upload size={15} /> Upload an image
                </button>
                <a href="/resizer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 9, border: "1.5px solid rgba(255,255,255,.22)", color: "#fff", fontWeight: 600, fontSize: "clamp(13px,1.5vw,15px)", padding: "clamp(13px,1.6vw,16px) clamp(24px,3vw,36px)", borderRadius: 14, textDecoration: "none", transition: "all .2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.5)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.22)")}>
                  Open App <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "clamp(24px,3vw,36px) clamp(16px,3vw,28px)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-.03em", color: "var(--text)" }}>SmartResize</span>
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>· Sharp + libvips</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {["Privacy", "Terms", "GitHub"].map(l => (
                <a key={l} href="#" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none", transition: "color .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>{l}</a>
              ))}
              <ThemeToggle size={30} />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 28px" }}>
            {[
              { Icon: Lock,   text: "No account required"       },
              { Icon: Shield, text: "EXIF & metadata stripping"  },
              { Icon: Zap,    text: "3 concurrent batch jobs"    },
              { Icon: Globe,  text: "5 output formats"           },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
                <Icon size={13} style={{ color: "var(--accent)" }} /> {text}
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 18, fontFamily: "var(--font-mono)" }}>
            © {new Date().getFullYear()} SmartResize. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
