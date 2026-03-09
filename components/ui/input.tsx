import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: Readonly<InputHTMLAttributes<HTMLInputElement>>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-[#800020] transition placeholder:text-slate-400 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}


