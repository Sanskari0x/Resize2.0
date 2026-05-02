"use client";

import { createContext, useContext, useEffect, useRef } from "react";

// We use a dynamic import pattern so SSR never touches Lenis
const LenisCtx = createContext<{ lenis: unknown | null }>({ lenis: null });
export const useLenis = () => useContext(LenisCtx);

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let rafId: number;

    // Dynamic import keeps Lenis out of SSR bundle
    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        smoothWheel: true,
        syncTouch: false,         // native feel on mobile
        touchMultiplier: 2,
        infinite: false,
      }) as { raf: (t: number) => void; destroy: () => void };

      lenisRef.current = lenis;

      function raf(time: number) {
        lenis!.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisCtx.Provider value={{ lenis: lenisRef.current }}>
      {children}
    </LenisCtx.Provider>
  );
}
