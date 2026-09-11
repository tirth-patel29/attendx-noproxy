import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * AttendX button. Heavily customized from the shadcn base:
 * hairline borders, soft cyan glow on primary, press physics via active:scale.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-medium tracking-[-0.005em] cursor-pointer select-none transition-[background,box-shadow,transform,color] duration-200 ease-out active:scale-[0.975] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-cyan text-primary-foreground shadow-[0_1px_0_oklch(1_0_0/0.35)_inset,0_8px_20px_-10px_oklch(0.6_0.13_220/0.65)] hover:shadow-[0_1px_0_oklch(1_0_0/0.35)_inset,0_12px_28px_-10px_oklch(0.6_0.13_220/0.8)] hover:brightness-[1.04]",
        solid:
          "bg-foreground text-background shadow-soft hover:bg-foreground/90",
        outline:
          "border border-border-strong bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-accent/40",
        subtle: "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90",
        link: "text-primary-deep underline-offset-4 hover:underline",
        glass:
          "glass-panel text-foreground hover:shadow-lift rounded-xl",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-6 text-sm",
        xl: "h-12 px-7 text-sm rounded-2xl",
        icon: "h-9 w-9 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-lg [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
