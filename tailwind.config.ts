import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "sans-serif"],
        mono: ["var(--font-mono)", "DM Mono", "monospace"],
      },
      colors: {
        border:      "hsl(var(--tw-border))",
        input:       "hsl(var(--tw-input))",
        ring:        "hsl(var(--tw-ring))",
        background:  "hsl(var(--tw-background))",
        foreground:  "hsl(var(--tw-foreground))",
        primary: {
          DEFAULT:     "hsl(var(--tw-primary))",
          foreground:  "hsl(var(--tw-primary-foreground))",
        },
        secondary: {
          DEFAULT:     "hsl(var(--tw-secondary))",
          foreground:  "hsl(var(--tw-secondary-foreground))",
        },
        destructive: {
          DEFAULT:     "hsl(var(--tw-destructive))",
          foreground:  "hsl(var(--tw-destructive-foreground))",
        },
        muted: {
          DEFAULT:     "hsl(var(--tw-muted))",
          foreground:  "hsl(var(--tw-muted-foreground))",
        },
        accent: {
          DEFAULT:     "hsl(var(--tw-accent))",
          foreground:  "hsl(var(--tw-accent-foreground))",
        },
        card: {
          DEFAULT:     "hsl(var(--tw-card))",
          foreground:  "hsl(var(--tw-card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        floatY:   { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        fadeSlide:{ from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        spin:     { to: { transform: "rotate(360deg)" } },
        pulse:    { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        marquee:  { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        shimmer:   "shimmer 2s linear infinite",
        floatY:    "floatY 3s ease-in-out infinite",
        fadeSlide: "fadeSlide 0.4s ease forwards",
        "spin-slow":"spin 2s linear infinite",
        pulse:     "pulse 1s ease-in-out infinite",
        marquee:   "marquee 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
