"use client";

import Image from "next/image";
import { useState } from "react";

/** Botão de copiar; sem permissão de área de transferência, mostra o texto para Ctrl+C. */
export function CopiarTexto({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [aviso, setAviso] = useState("");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Copiado!");
    } catch {
      setAviso("Não deu para copiar sozinho: abra o texto abaixo e use Ctrl+C.");
    }
    setTimeout(() => setAviso(""), 2500);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copiar} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold hover:border-gold-400">
        {rotulo}
      </button>
      <span role="status" className="text-xs text-ink-500">{aviso}</span>
    </span>
  );
}

/** Arte do exemplo; enquanto o arquivo não foi gerado, mostra um aviso no lugar. */
export function ArteExemplo({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  const [falta, setFalta] = useState(false);
  if (falta) {
    return (
      <div style={{ aspectRatio: `${w} / ${h}` }} className="flex items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-center text-xs text-ink-500">
        Arte ainda não gerada. Copie o prompt do Codex abaixo.
      </div>
    );
  }
  return <Image src={src} alt={alt} width={w} height={h} sizes="(min-width: 1024px) 22vw, 50vw" className="h-auto w-full rounded-xl" onError={() => setFalta(true)} />;
}
