import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--text)] text-[var(--bg)] hover:opacity-85 shadow-sm",
        gradient:
          "bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-[0_4px_20px_rgba(0,229,255,0.3)] hover:shadow-[0_6px_28px_rgba(0,229,255,0.45)] hover:scale-[1.02]",
        outline:
          "border border-[var(--border2)] bg-transparent text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
        ghost:
          "bg-transparent text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]",
        destructive:
          "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20",
        success:
          "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_24px_rgba(16,185,129,0.45)] hover:scale-[1.02]",
        pill:
          "rounded-full bg-[var(--text)] text-[var(--bg)] hover:opacity-85 shadow-md",
        "pill-outline":
          "rounded-full border border-[var(--border2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
        accent:
          "bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-12 px-8 text-base",
        xl:      "h-14 px-10 text-base font-bold",
        icon:    "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild: _asChild, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
