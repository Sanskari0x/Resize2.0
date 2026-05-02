"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeCtx {
  theme: Theme;          // stored preference
  resolved: "light" | "dark"; // what's actually showing
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "system", resolved: "dark",
  setTheme: () => {}, toggle: () => {},
});

export function useTheme() { return useContext(Ctx); }

// ── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,    setThemeState] = useState<Theme>("system");
  const [resolved, setResolved]   = useState<"light"|"dark">("dark");

  // Apply theme to <html data-theme="">
  const applyTheme = useCallback((t: Theme) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const actual: "light"|"dark" =
      t === "system" ? (prefersDark ? "dark" : "light") : t;
    document.documentElement.dataset.theme = actual;
    setResolved(actual);
  }, []);

  // On mount: read stored preference, fall back to system
  useEffect(() => {
    const stored = (localStorage.getItem("sr-theme") as Theme) ?? "system";
    setThemeState(stored);
    applyTheme(stored);

    // Listen for system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (stored === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [applyTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("sr-theme", t);
    applyTheme(t);
  }, [applyTheme]);

  // Toggle between light and dark (skips "system")
  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</Ctx.Provider>;
}

// ── Theme Toggle Button ───────────────────────────────────────────────────────
export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { resolved, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Render nothing until hydrated to avoid SSR mismatch
  if (!mounted) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "transparent" }} />
  );

  return (
    <button
      onClick={toggle}
      className="theme-toggle"
      style={{ width: size, height: size }}
      aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
    >
      {resolved === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

// ── Inline script to prevent FOUC (injected in <head> before React hydrates) ─
// This sets data-theme immediately from localStorage, before any React code runs.
export const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
(function(){
  try {
    var t = localStorage.getItem('sr-theme') || 'system';
    var actual = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.dataset.theme = actual;
  } catch(e) {}
})();
      `.trim(),
    }}
  />
);
