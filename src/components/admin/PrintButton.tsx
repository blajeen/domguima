"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950 hover:bg-gold-300">Exportar / salvar PDF</button>;
}
