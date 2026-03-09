import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function toFriendlyLabel(value?: string | null, fallback = "-") {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  const openBracketIndex = raw.lastIndexOf("[");
  const closeBracketIndex = raw.lastIndexOf("]");
  const hasTrailingBracketId =
    openBracketIndex >= 0 &&
    closeBracketIndex === raw.length - 1 &&
    openBracketIndex < closeBracketIndex;

  const noBracketId = hasTrailingBracketId ? raw.slice(0, openBracketIndex).trim() : raw;
  return noBracketId || fallback;
}
