import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        variant === "primary" && "bg-[#800020] text-white hover:bg-[#68001a]",
        variant === "secondary" && "bg-[#f8ecd1] text-[#4a0012] hover:bg-[#f1dfb1]",
        variant === "ghost" && "bg-transparent text-[#800020] hover:bg-[#fff8e8]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
}

