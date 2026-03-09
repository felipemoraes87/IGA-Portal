import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("rounded-2xl border border-[#f1e6c9] bg-white p-5 shadow-sm", className)} {...props} />;
}


