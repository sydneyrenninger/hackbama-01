import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display text-sm font-bold tracking-[-0.01em] transition-[transform,box-shadow,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-2 border-ink bg-primary text-primary-foreground shadow-brut-sm lift",
        secondary: "border-2 border-ink bg-pop text-ink shadow-brut-sm lift",
        outline: "border-2 border-ink bg-card text-ink shadow-brut-sm lift",
        ghost: "text-ink hover:bg-ink/[0.07]",
        link: "text-primary underline decoration-2 underline-offset-4 hover:decoration-pop px-0",
      },
      size: { default: "h-11 px-5", sm: "h-9 px-3.5 text-[13px]", lg: "h-13 px-7 text-base", icon: "h-11 w-11" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";
