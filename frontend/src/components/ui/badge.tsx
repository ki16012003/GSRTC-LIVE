import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-black/[0.04] text-gray-700 ring-black/10",
        moving: "bg-green-100 text-green-700 ring-green-600/20",
        idle: "bg-amber-100 text-amber-700 ring-amber-600/20",
        stopped: "bg-red-100 text-red-700 ring-red-600/20",
        offline: "bg-gray-100 text-gray-600 ring-gray-500/20",
        selected: "bg-blue-100 text-blue-700 ring-blue-600/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const dotVariants: Record<string, string> = {
  default: "bg-gray-500",
  moving: "bg-green-500",
  idle: "bg-amber-500",
  stopped: "bg-red-500",
  offline: "bg-gray-400",
  selected: "bg-blue-500",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotVariants[variant || "default"],
            variant === "moving" && "animate-pulse"
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
