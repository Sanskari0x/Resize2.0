import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:   "border-transparent bg-[var(--text)] text-[var(--bg)]",
        secondary: "border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)]",
        accent:    "border-[var(--accent)]/30 bg-[var(--accent-dim)] text-[var(--accent)]",
        success:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        warning:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
        new:       "border-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white",
        outline:   "border-[var(--border2)] bg-transparent text-[var(--text2)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
