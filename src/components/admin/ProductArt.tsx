"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findOfficialPhotosAction, productArtAction } from "@/app/painel/actions";
import type { OfficialPhoto } from "@/lib/admin/product-art";
import type { AdminProductImage } from "@/lib/admin/types";
import { labelClass, fieldClass } from "./FormControls";

interface Escolha { url: string; rotulo: string; origem: string; detalhe: string }

/**
 * Capa limpa e imagem explicativa a partir de foto REAL: as oficiais achadas
 * nas paginas do fabricante/lojas, ou as que o lojista ja enviou. Nada e
 * redesenhado; a montagem so recorta a borda, centraliza e poe fundo.
 */
/** Cadastro ainda nao salvo: busca as fotos sozinho e manda as escolhas junto com o formulario. */
export interface DraftArtQuery { name: string; brand: string; model: string; gtin: string; sourceUrl: string }

export function ProductArt({ productId = "", images = [], defaultBenefits, draft }: { productId?: string; images?: AdminProductImage[]; defaultBenefits: string[]; draft?: DraftArtQuery }) {
  const router = useRouter();
  const [oficiais, setOficiais] = useState<OfficialPhoto[]>([]);
  const [buscando, setBuscando] = useState(Boolean(draft));
  // No cadastro novo as imagens vao junto ao salvar; o lojista pode desligar.
  const [criarAoSalvar, setCriarAoSalvar] = useState(true);
  const [capa, setCapa] = useState("");
  const [lado, setLado] = useState("");
  const [beneficios, setBeneficios] = useState(defaultBenefits.slice(0, 5).join("\n"));
  const [previa, setPrevia] = useState<{ cover: string; explainer: string; enlarged: boolean } | null>(null);
  const [trabalhando, setTrabalhando] = useState<"" | "preview" | "save">("");
  const [mensagem, setMensagem] = useState("");

  const escolhas: Escolha[] = [
    ...oficiais.map((foto) => ({ url: foto.url, rotulo: foto.domain, origem: foto.manufacturer ? "Fabricante" : "Loja", detalhe: `${foto.width} × ${foto.height}` })),
    ...images.map((foto, indice) => ({ url: foto.src, rotulo: `Sua foto ${indice + 1}`, origem: "Enviada", detalhe: "" })),
  ];
  const listaDeBeneficios = beneficios.split("\n").map((linha) => linha.replace(/^[-•*]\s*/, "").trim().slice(0, 70)).filter(Boolean).slice(0, 5);

  // Cadastro novo: o componente e recriado a cada busca (key no formulario),
  // entao a busca de fotos roda uma vez por produto pesquisado.
  useEffect(() => {
    if (!draft) return;
    let vivo = true;
    findOfficialPhotosAction(draft).then((resposta) => {
      if (!vivo) return;
      const fotos = resposta.photos ?? [];
      setOficiais(fotos);
      setCapa(fotos[0]?.url ?? "");
      setLado(fotos[1]?.url ?? fotos[0]?.url ?? "");
      setMensagem(resposta.message ?? (fotos.length ? "Fotos encontradas: a capa e o outro ângulo já foram escolhidos. Troque se quiser." : ""));
    }).catch(() => { if (vivo) setMensagem("Não foi possível buscar as fotos agora. Depois de salvar, tente pelo quadro de imagens."); })
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma busca por montagem
  }, []);
  const vaiCriar = Boolean(draft) && criarAoSalvar && Boolean(capa && lado) && listaDeBeneficios.length > 0;

  async function buscar() {
    setBuscando(true); setMensagem("");
    try {
      const resposta = await findOfficialPhotosAction(productId);
      setOficiais(resposta.photos ?? []);
      setMensagem(resposta.message ?? (resposta.ok ? `${resposta.photos?.length ?? 0} foto(s) encontradas. Escolha a capa e o outro ângulo.` : ""));
    } catch { setMensagem("Não foi possível buscar as fotos agora."); }
    finally { setBuscando(false); }
  }

  async function montar(mode: "preview" | "save") {
    if (!capa || !lado) { setMensagem("Escolha a foto da capa e a do outro ângulo."); return; }
    if (listaDeBeneficios.length < 1 || listaDeBeneficios.length > 5) { setMensagem("Escreva de 1 a 5 vantagens, uma por linha."); return; }
    setTrabalhando(mode); setMensagem("");
    try {
      const resposta = await productArtAction({ productId, coverUrl: capa, sideUrl: lado, benefits: listaDeBeneficios, mode });
      if (!resposta.ok) { setMensagem(resposta.message ?? "Não foi possível montar as imagens."); return; }
      if (mode === "preview" && resposta.cover && resposta.explainer) setPrevia({ cover: resposta.cover, explainer: resposta.explainer, enlarged: Boolean(resposta.enlarged) });
      if (mode === "save") { setMensagem(resposta.message ?? "Imagens salvas."); setPrevia(null); router.refresh(); }
    } catch { setMensagem("Não foi possível montar as imagens agora."); }
    finally { setTrabalhando(""); }
  }

  return <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
    {vaiCriar && <><input type="hidden" name="artCover" value={capa} /><input type="hidden" name="artSide" value={lado} /><input type="hidden" name="artBenefits" value={JSON.stringify(listaDeBeneficios)} /></>}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-black">Capa e imagem explicativa</h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-500">Duas imagens quadradas em JPG (2000 × 2000) feitas com foto real do produto: a capa limpa e outra com um segundo ângulo e as vantagens. O aparelho não é redesenhado nem alterado.</p>
      </div>
      {!draft && <button type="button" onClick={buscar} disabled={buscando} className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60">{buscando ? "Buscando fotos… (até 1 min)" : "Buscar fotos oficiais"}</button>}
      {draft && buscando && <p className="text-xs font-bold text-blue-700">Buscando fotos oficiais… (até 1 min)</p>}
    </div>

    {escolhas.length === 0
      ? <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">Busque as fotos oficiais ou envie suas fotos acima para montar as imagens.</p>
      : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{escolhas.map((foto) => <article key={foto.url} className={`overflow-hidden rounded-xl border ${capa === foto.url || lado === foto.url ? "border-blue-400 ring-2 ring-blue-100" : "border-ink-100"}`}>
        <div className="aspect-square bg-white"><img src={foto.url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain p-2" /></div>
        <div className="space-y-1 border-t border-ink-100 p-2 text-[11px]">
          <p className="truncate font-bold text-ink-700" title={foto.rotulo}>{foto.rotulo}</p>
          <p className="text-ink-400">{foto.origem}{foto.detalhe && ` · ${foto.detalhe}`}</p>
          <label className="flex items-center gap-1.5"><input type="radio" name="art-capa" checked={capa === foto.url} onChange={() => { setCapa(foto.url); setPrevia(null); }} />Capa</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="art-lado" checked={lado === foto.url} onChange={() => { setLado(foto.url); setPrevia(null); }} />Outro ângulo</label>
          {foto.origem !== "Enviada" && <a href={oficiais.find((item) => item.url === foto.url)?.pageUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-700 underline">ver página</a>}
        </div>
      </article>)}</div>}

    <label className={`${labelClass} mt-4 block`}>Vantagens (uma por linha, até 5)
      <textarea value={beneficios} onChange={(event) => { setBeneficios(event.target.value); setPrevia(null); }} rows={5} className={fieldClass} placeholder={"Jarra de 600 ml com medidor\nLâmina em aço inox"} />
    </label>

    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => montar("preview")} disabled={Boolean(trabalhando)} className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-xs font-black text-ink-800 disabled:opacity-50">{trabalhando === "preview" ? "Montando prévia…" : "Ver prévia"}</button>
      {!draft && <button type="button" onClick={() => montar("save")} disabled={Boolean(trabalhando)} className="rounded-lg bg-gold-500 px-4 py-2.5 text-xs font-black text-ink-900 disabled:opacity-50">{trabalhando === "save" ? "Salvando…" : "Salvar as 2 imagens no produto"}</button>}
      {draft && <label className="flex items-center gap-2 text-xs font-bold text-ink-800"><input type="checkbox" checked={criarAoSalvar} onChange={(event) => setCriarAoSalvar(event.target.checked)} className="h-4 w-4" />Criar as 2 imagens ao salvar o produto</label>}
    </div>

    {mensagem && <p role="status" className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-900">{mensagem}</p>}

    {previa && <div className="mt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <figure><img src={previa.cover} alt="Prévia da capa" className="w-full rounded-xl border border-ink-100" /><figcaption className="mt-1 text-[11px] text-ink-500">Capa</figcaption></figure>
        <figure><img src={previa.explainer} alt="Prévia da imagem explicativa" className="w-full rounded-xl border border-ink-100" /><figcaption className="mt-1 text-[11px] text-ink-500">Explicativa</figcaption></figure>
      </div>
      {previa.enlarged && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">A foto original é menor que o quadro e foi ampliada para caber. Isso não acrescenta detalhe — se tiver uma foto maior, prefira ela.</p>}
    </div>}

    <p className="mt-3 text-[10px] leading-relaxed text-ink-400">Fotos de fabricantes e lojas podem ter direitos de uso. Prefira as do fabricante do produto que você revende e confira se é o modelo e a cor certos antes de salvar.</p>
  </section>;
}
