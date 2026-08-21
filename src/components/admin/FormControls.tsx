"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/admin/types";

export function SubmitButton({ children = "Salvar", pendingLabel = "Salvando...", className = "" }: { children?: React.ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950 transition-colors hover:bg-gold-300 disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-success-light text-success" : "bg-red-50 text-red-700"}`}>{state.message}</p>;
}

export const fieldClass = "mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-100";
export const labelClass = "block text-xs font-bold text-ink-600";
