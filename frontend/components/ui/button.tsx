import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[11px] text-sm font-bold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default:
          "ds-hard border-2 border-ds-ink bg-ds-accent text-white shadow-hard hover:bg-[#e84733]",
        destructive:
          "border-2 border-ds-ink bg-destructive text-destructive-foreground shadow-hard hover:bg-destructive/90",
        outline:
          "border-2 border-ds-ink bg-card text-foreground shadow-hard hover:bg-ds-lime",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-ds-ink hover:bg-ds-brand-soft",
        ghost:
          "text-foreground hover:bg-ds-brand-soft hover:text-ds-brand",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[10px] px-3",
        lg: "h-11 rounded-[12px] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
