import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, ThemeScript } from "./components/ThemeProvider";
import { LenisProvider } from "./components/LenisProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap", axes: ["opsz"] });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], variable: "--font-serif", weight: "400", style: ["normal", "italic"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "SmartResize — Photoshop-quality Image Resizer",
  description: "Content-aware image resizing powered by Sharp. Resize, convert, and optimize images with professional quality.",
  icons: { icon: "/icon.png", apple: "/icon.png", shortcut: "/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>
          <LenisProvider>
            {children}
            <Toaster
              position="bottom-right"
              theme="system"
              richColors
              closeButton
              toastOptions={{
                style: {
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                },
                duration: 3500,
              }}
            />
          </LenisProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
