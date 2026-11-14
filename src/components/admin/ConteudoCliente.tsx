"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/admin/types";
import { salvarPostagemAction } from "@/app/painel/actions";
import { FORMATOS } from "@/lib/content/exemplosConteudo";
import { LEGENDA_MAX, TITULO_MAX, type PostagemPlanejada } from "@/lib/content/postagens";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

type Rascunho = Omit<PostagemPlanejada, "id"> & { id?: string };

/** Formulário de nova postagem ou de edição (com `inicial.id`). `imagens`: artes do site para sugerir. */
export function PostagemForm({ inicial, imagens }: { inicial: Rascunho; imagens: string[] }) {
  const [legenda, setLegenda] = useState(inicial.legenda);
  const [imagem, setImagem] = useState(inicial.imagem);
  const [state, action] = useActionState(async (antes: ActionState, dados: FormData) => {
    const r = await salvarPostagemAction(antes, dados);
    // Post novo salvo: limpa os campos controlados (o React já limpa o resto do form).
    if (r.ok && !inicial.id) {
      setLegenda("");
      setImagem("");
    }
    return r;
  }, {});
  return (
    <form action={action} className="grid gap-3">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>Dia<input type="date" name="dia" required defaultValue={inicial.dia} className={fieldClass} /></label>
        <label className={labelClass}>Hora<input type="time" name="hora" defaultValue={inicial.hora} className={fieldClass} /></label>
      </div>
      <label className={labelClass}>Formato
        <select name="formato" defaultValue={inicial.formato} className={fieldClass}>
          {Object.entries(FORMATOS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        </select>
      </label>
      <label className={labelClass}>Título (só para o calendário)<input name="titulo" required maxLength={TITULO_MAX} defaultValue={inicial.titulo} className={fieldClass} /></label>
      <label className={labelClass}>Legenda <span className="font-normal text-ink-500">{[...legenda].length}/{LEGENDA_MAX}</span>
        <textarea name="legenda" rows={6} value={legenda} onChange={(e) => setLegenda(e.target.value)} className={fieldClass} />
      </label>
      <label className={labelClass}>Arte (arquivo do site ou link https)
        <input name="imagem" list="artes-do-site" value={imagem} onChange={(e) => setImagem(e.target.value)} placeholder="/brand/exemplos/01-boas-vindas.png" className={fieldClass} />
        <datalist id="artes-do-site">{imagens.map((src) => <option key={src} value={src} />)}</datalist>
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element -- prévia do que foi digitado; pode não existir ainda */}
      {imagem && <img src={imagem} alt="" className="max-h-48 w-auto rounded-lg border border-ink-100" onError={(e) => (e.currentTarget.style.display = "none")} onLoad={(e) => (e.currentTarget.style.display = "")} />}
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>Situação
          <select name="status" defaultValue={inicial.status} className={fieldClass}>
            <option value="planejado">Planejado</option>
            <option value="publicado">Publicado</option>
          </select>
        </label>
        <label className={labelClass}>Link do post<input type="url" name="link" defaultValue={inicial.link} placeholder="https://instagram.com/p/..." className={fieldClass} /></label>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{inicial.id ? "Salvar alterações" : "Planejar postagem"}</SubmitButton>
    </form>
  );
}

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
