import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes } from "react";

export function Textarea({ className, ...props }: Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-[#800020] transition placeholder:text-slate-400 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}


