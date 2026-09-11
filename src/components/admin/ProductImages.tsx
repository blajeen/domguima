"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  createImageUploadTargetsAction,
  registerProductImagesAction,
  removeProductImageAction,
  setPrimaryImageAction,
} from "@/app/painel/actions";
import type { ActionState, AdminProductImage } from "@/lib/admin/types";
import { fieldClass, FormMessage, labelClass } from "./FormControls";

/**
 * Envio de fotos do produto.
 *
 * O arquivo vai do navegador DIRETO para o Storage, por URL assinada. Passar
 * pelo servidor batia no teto de corpo de requisicao da hospedagem — medido em
 * producao como HTTP 413 num lote de 8 MB —, e foto de celular estoura isso
 * sozinha.
 *
 * Antes de subir, cada foto e reduzida aqui mesmo: no maximo 2000px no lado
 * maior, reconvertida para WebP. Isso resolve a queixa de "nao aceita imagem
 * em alta resolucao" sem precisar guardar o original de 12 MB, que ninguem ve
 * numa pagina de produto e so deixaria a loja mais lenta.
 */

const LADO_MAXIMO = 2000;
const QUALIDADE = 0.82;
/** Teto do bucket. A reducao acima costuma deixar bem abaixo disso. */
const TAMANHO_MAXIMO = 4 * 1024 * 1024;

const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function emMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function reduzir(file: File): Promise<File> {
  // Sem canvas (navegador antigo ou formato exotico), sobe o original e deixa
  // a validacao de tamanho decidir.
  if (typeof document === "undefined") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALIDADE));
  // Foto ja pequena e otimizada pode ficar MAIOR depois da reconversao.
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

interface Progresso {
  enviando: boolean;
  feitas: number;
  total: number;
  etapa: string;
}

export function ProductImages({ productId, images }: { productId: string; images: AdminProductImage[] }) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [alt, setAlt] = useState("Foto do produto");
  const [estado, setEstado] = useState<ActionState>({});
  const [progresso, setProgresso] = useState<Progresso>({ enviando: false, feitas: 0, total: 0, etapa: "" });

  const ordered = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);

  async function enviar() {
    if (!arquivos.length) return;
    setEstado({});
    setProgresso({ enviando: true, feitas: 0, total: arquivos.length, etapa: "Preparando as fotos..." });

    try {
      const reduzidas: File[] = [];
      for (const [indice, arquivo] of arquivos.entries()) {
        setProgresso({ enviando: true, feitas: indice, total: arquivos.length, etapa: `Preparando ${indice + 1} de ${arquivos.length}...` });
        // Formato errado e barrado aqui, dizendo qual arquivo e o porque.
        if (!TIPOS_ACEITOS.has(arquivo.type)) {
          setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
          setEstado({ message: `“${arquivo.name}” não é uma imagem aceita (${arquivo.type || "formato desconhecido"}). Use JPG, PNG ou WebP.` });
          return;
        }

        const menor = await reduzir(arquivo);
        if (menor.size > TAMANHO_MAXIMO) {
          setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
          // A mensagem diz o tamanho original, o tamanho depois da reducao e o
          // limite — sem isso o lojista so ve "deu erro" e nao sabe o que fazer.
          setEstado({
            message: `“${arquivo.name}” tem ${emMB(arquivo.size)} e, mesmo reduzida, ficou em ${emMB(menor.size)} — acima do limite de 4 MB por foto. `
              + "Isso acontece com imagem muito detalhada. Abra a foto, salve como JPG com qualidade menor e envie de novo.",
          });
          return;
        }
        reduzidas.push(menor);
      }

      const preparo = await createImageUploadTargetsAction(
        productId,
        reduzidas.map((arquivo) => ({ type: arquivo.type, size: arquivo.size })),
      );
      if (!preparo.ok || !preparo.targets) {
        setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
        setEstado({ message: preparo.message ?? "Não foi possível preparar o envio." });
        return;
      }

      const enviados: string[] = [];
      const falhadas: string[] = [];
      for (const [indice, arquivo] of reduzidas.entries()) {
        const alvo = preparo.targets[indice];
        setProgresso({ enviando: true, feitas: indice, total: reduzidas.length, etapa: `Enviando ${indice + 1} de ${reduzidas.length}...` });
        const resposta = await fetch(alvo.signedUrl, {
          method: "PUT",
          body: arquivo,
          headers: { "content-type": arquivo.type },
        });
        // Uma foto que falha nao derruba o lote: as outras seguem, e a
        // mensagem final diz quantas ficaram de fora.
        if (resposta.ok) enviados.push(alvo.storagePath);
        else falhadas.push(`${arquivo.name} (${resposta.status === 413 ? "arquivo grande demais" : `erro ${resposta.status}`})`);
      }

      if (!enviados.length) {
        setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
        setEstado({ message: `Nenhuma foto chegou ao servidor${falhadas.length ? `: ${falhadas.join(", ")}` : ""}. Confira a conexão e tente de novo.` });
        return;
      }

      setProgresso({ enviando: true, feitas: enviados.length, total: reduzidas.length, etapa: "Registrando no catálogo..." });
      const resultado = await registerProductImagesAction(productId, enviados, alt);
      // Sucesso parcial precisa dizer QUAL foto ficou de fora e por que.
      setEstado(falhadas.length && resultado.ok
        ? { ok: true, message: `${resultado.message} Ficaram de fora: ${falhadas.join(", ")}.` }
        : resultado);
      setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
      if (resultado.ok) setArquivos([]);
    } catch (error) {
      console.error("Falha no envio de fotos:", error);
      setProgresso({ enviando: false, feitas: 0, total: 0, etapa: "" });
      setEstado({ message: "Não foi possível enviar as fotos agora. Tente novamente." });
    }
  }

  return <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
    <h2 className="text-base font-black">Fotos do produto</h2>
    <p className="mt-1 text-xs text-ink-500">
      Selecione várias de uma vez. Pode mandar foto em alta resolução — ela é reduzida para até {LADO_MAXIMO}px antes de subir.
      JPG, PNG ou WebP, até 4 MB por foto <em>depois</em> da redução.
    </p>

    {ordered.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{ordered.map((image) => <article key={image.id} className={`overflow-hidden rounded-xl border ${image.is_primary ? "border-gold-400 ring-2 ring-gold-100" : "border-ink-100"}`}>
      <div className="aspect-square bg-ink-50"><img src={image.src} alt={image.alt} className="h-full w-full object-contain p-2" /></div>
      <div className="space-y-2 border-t border-ink-100 p-2">{image.is_primary ? <p className="text-[10px] font-black uppercase tracking-wide text-gold-700">Foto principal</p> : <form action={setPrimaryImageAction}><input type="hidden" name="imageId" value={image.id} /><input type="hidden" name="productId" value={productId} /><button className="text-[11px] font-bold text-ink-600 hover:text-gold-700">Tornar principal</button></form>}<form action={removeProductImageAction}><input type="hidden" name="imageId" value={image.id} /><button className="text-[11px] font-bold text-red-600 hover:underline">Remover</button></form></div>
    </article>)}</div>}

    <div className="mt-5 grid gap-3 rounded-xl bg-ink-50 p-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
      <label className={labelClass}>Arquivos
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={progresso.enviando}
          onChange={(event) => { setArquivos([...(event.target.files ?? [])]); setEstado({}); }}
          className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-gold-100 file:px-3 file:py-1 file:font-bold`}
        />
        <span className="mt-1 block font-normal text-ink-400">
          {arquivos.length
            ? `${arquivos.length} ${arquivos.length === 1 ? "foto selecionada" : "fotos selecionadas"} · ${(arquivos.reduce((soma, item) => soma + item.size, 0) / 1024 / 1024).toFixed(1)} MB no total`
            : "Você pode selecionar várias segurando Ctrl ou Shift."}
        </span>
      </label>

      <label className={labelClass}>Descrição base
        <input value={alt} onChange={(event) => setAlt(event.target.value)} disabled={progresso.enviando} className={fieldClass} />
        <span className="mt-1 block font-normal text-ink-400">A numeração será adicionada automaticamente.</span>
      </label>

      <button
        type="button"
        onClick={() => void enviar()}
        disabled={progresso.enviando || !arquivos.length}
        className="rounded-xl bg-ink-900 px-4 py-3 text-sm font-black text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {progresso.enviando ? "Enviando..." : `Enviar ${arquivos.length > 1 ? `${arquivos.length} fotos` : "foto"}`}
      </button>

      <div className="sm:col-span-3">
        {progresso.enviando && <p role="status" className="mb-2 text-xs font-bold text-blue-700">{progresso.etapa}</p>}
        <FormMessage state={estado} />
      </div>
    </div>
  </section>;
}
