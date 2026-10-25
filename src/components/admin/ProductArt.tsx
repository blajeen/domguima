"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { aiProductPhotosAction, findOfficialPhotosAction, productArtAction } from "@/app/painel/actions";
import type { OfficialPhoto } from "@/lib/admin/product-art";
import type { AdminProductImage } from "@/lib/admin/types";
import { labelClass, fieldClass } from "./FormControls";

interface Escolha { url: string; rotulo: string; origem: string; detalhe: string; pageUrl: string; ai: boolean }

/** Cadastro ainda nao salvo: busca as fotos sozinho e manda as escolhas junto com o formulario. */
export interface DraftArtQuery { name: string; brand: string; model: string; gtin: string; sourceUrl: string; color: string; details: string[] }

/**
 * Capa limpa e imagem explicativa. A foto do produto vem, nesta ordem: das
 * paginas do fabricante/lojas, das fotos que o lojista enviou ou, sem
 * nenhuma, desenhada pela IA no padrao de Configuracoes (marcada como "IA").
 * A montagem so recorta a borda, centraliza, poe fundo e escreve as vantagens.
 */
export function ProductArt({ productId = "", images = [], defaultBenefits, draft }: { productId?: string; images?: AdminProductImage[]; defaultBenefits: string[]; draft?: DraftArtQuery }) {
  const router = useRouter();
  const [fotos, setFotos] = useState<OfficialPhoto[]>([]);
  const [buscando, setBuscando] = useState(Boolean(draft));
  const [gerandoIa, setGerandoIa] = useState(false);
  // No cadastro novo as imagens vao junto ao salvar; o lojista pode desligar.
  const [criarAoSalvar, setCriarAoSalvar] = useState(true);
  const [capa, setCapa] = useState("");
  const [lado, setLado] = useState("");
  const [beneficios, setBeneficios] = useState(defaultBenefits.slice(0, 5).join("\n"));
  const [previa, setPrevia] = useState<{ cover: string; explainer: string; enlarged: boolean } | null>(null);
  const [trabalhando, setTrabalhando] = useState<"" | "preview" | "save">("");
  const [mensagem, setMensagem] = useState("");

  const escolhas: Escolha[] = [
    ...fotos.map((foto) => ({ url: foto.url, rotulo: foto.domain, origem: foto.ai ? "IA" : foto.manufacturer ? "Fabricante" : "Loja", detalhe: `${foto.width} × ${foto.height}`, pageUrl: foto.pageUrl, ai: Boolean(foto.ai) })),
    ...images.map((foto, indice) => ({ url: foto.src, rotulo: `Sua foto ${indice + 1}`, origem: "Enviada", detalhe: "", pageUrl: "", ai: false })),
  ];
  const listaDeBeneficios = beneficios.split("\n").map((linha) => linha.replace(/^[-•*]\s*/, "").trim().slice(0, 70)).filter(Boolean).slice(0, 5);
  const usaIa = escolhas.some((foto) => foto.ai && (foto.url === capa || foto.url === lado));

  /** Junta as fotos novas as que ja estavam e escolhe capa e outro angulo se ainda nao houver. */
  function receber(novas: OfficialPhoto[]) {
    setFotos((atuais) => [...novas, ...atuais.filter((foto) => !novas.some((nova) => nova.url === foto.url))]);
    if (novas.length) { setCapa(novas[0].url); setLado(novas[1]?.url ?? novas[0].url); setPrevia(null); }
  }

  async function gerarComIa(): Promise<boolean> {
    setGerandoIa(true);
    try {
      const resposta = await aiProductPhotosAction(draft ? { name: draft.name, brand: draft.brand, model: draft.model, color: draft.color, details: draft.details.slice(0, 8) } : productId);
      if (!resposta.ok || !resposta.photos?.length) { setMensagem(resposta.message ?? "A IA não gerou as imagens."); return false; }
      receber(resposta.photos);
      setMensagem("Fotos geradas pela IA no padrão da loja. Confira se o produto está igual ao que você vende antes de salvar.");
      return true;
    } catch { setMensagem("Não foi possível gerar as imagens com IA agora."); return false; }
    finally { setGerandoIa(false); }
  }

  // Cadastro novo: o componente e recriado a cada busca (key no formulario).
  // Busca as fotos reais uma vez; sem nenhuma, a IA desenha no padrao da loja.
  useEffect(() => {
    if (!draft) return;
    let vivo = true;
    findOfficialPhotosAction(draft).then(async (resposta) => {
      if (!vivo) return;
      const achadas = resposta.photos ?? [];
      if (achadas.length) {
        receber(achadas);
        setMensagem("Fotos encontradas: a capa e o outro ângulo já foram escolhidos. Troque se quiser.");
        return;
      }
      setBuscando(false);
      if (vivo) await gerarComIa();
    }).catch(() => { if (vivo) setMensagem("Não foi possível buscar as fotos agora. Use “Gerar fotos com IA”."); })
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma busca por montagem
  }, []);
  const vaiCriar = Boolean(draft) && criarAoSalvar && Boolean(capa && lado) && listaDeBeneficios.length > 0;

  async function buscar() {
    setBuscando(true); setMensagem("");
    try {
      const resposta = await findOfficialPhotosAction(productId);
      receber(resposta.photos ?? []);
      setMensagem(resposta.message ?? (resposta.ok ? `${resposta.photos?.length ?? 0} foto(s) encontradas. Escolha a capa e o outro ângulo.` : ""));
    } catch { setMensagem("Não foi possível buscar as fotos agora."); }
    finally { setBuscando(false); }
  }

  async function montar(mode: "preview" | "save") {
    if (!capa || !lado) { setMensagem("Escolha a foto da capa e a do outro ângulo."); return; }
    if (listaDeBeneficios.length < 1) { setMensagem("Escreva de 1 a 5 vantagens, uma por linha."); return; }
    setTrabalhando(mode); setMensagem("");
    try {
      const resposta = await productArtAction({ productId, coverUrl: capa, sideUrl: lado, benefits: listaDeBeneficios, mode });
      if (!resposta.ok) { setMensagem(resposta.message ?? "Não foi possível montar as imagens."); return; }
      if (mode === "preview" && resposta.cover && resposta.explainer) setPrevia({ cover: resposta.cover, explainer: resposta.explainer, enlarged: Boolean(resposta.enlarged) });
      if (mode === "save") { setMensagem(resposta.message ?? "Imagens salvas."); setPrevia(null); router.refresh(); }
    } catch { setMensagem("Não foi possível montar as imagens agora."); }
    finally { setTrabalhando(""); }
  }

  const ocupado = buscando || gerandoIa;
  return <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
    {vaiCriar && <><input type="hidden" name="artCover" value={capa} /><input type="hidden" name="artSide" value={lado} /><input type="hidden" name="artBenefits" value={JSON.stringify(listaDeBeneficios)} /></>}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-black">Capa e imagem explicativa</h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-500">Duas imagens quadradas em JPG (2000 × 2000): a capa limpa e outra com um segundo ângulo e as vantagens. Usa foto real quando encontra; sem foto, a IA desenha no padrão definido em Configurações.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!draft && <button type="button" onClick={buscar} disabled={ocupado} className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60">{buscando ? "Buscando fotos… (até 1 min)" : "Buscar fotos oficiais"}</button>}
        <button type="button" onClick={() => void gerarComIa()} disabled={ocupado} className="rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-xs font-black text-blue-800 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60">{gerandoIa ? "Gerando com IA… (até 1 min)" : "Gerar fotos com IA"}</button>
      </div>
    </div>
    {draft && buscando && <p className="mt-2 text-xs font-bold text-blue-700">Buscando fotos oficiais… (até 1 min)</p>}

    {escolhas.length === 0
      ? <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{ocupado ? "Aguarde: as fotos aparecem aqui." : "Busque as fotos oficiais, gere com IA ou envie suas fotos para montar as imagens."}</p>
      : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{escolhas.map((foto) => <article key={foto.url} className={`overflow-hidden rounded-xl border ${capa === foto.url || lado === foto.url ? "border-blue-400 ring-2 ring-blue-100" : "border-ink-100"}`}>
        <div className="relative aspect-square bg-white"><img src={foto.url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain p-2" />{foto.ai && <span className="absolute left-1.5 top-1.5 rounded bg-purple-700 px-1.5 py-0.5 text-[9px] font-black text-white">IA</span>}</div>
        <div className="space-y-1 border-t border-ink-100 p-2 text-[11px]">
          <p className="truncate font-bold text-ink-700" title={foto.rotulo}>{foto.rotulo}</p>
          <p className="text-ink-400">{foto.origem}{foto.detalhe && ` · ${foto.detalhe}`}</p>
          <label className="flex items-center gap-1.5"><input type="radio" name="art-capa" checked={capa === foto.url} onChange={() => { setCapa(foto.url); setPrevia(null); }} />Capa</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="art-lado" checked={lado === foto.url} onChange={() => { setLado(foto.url); setPrevia(null); }} />Outro ângulo</label>
          {foto.pageUrl && <a href={foto.pageUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-700 underline">ver página</a>}
        </div>
      </article>)}</div>}

    {usaIa && <p className="mt-3 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-900"><strong>Foto desenhada por IA:</strong> pode não ser idêntica ao produto real. Confira modelo, cor e detalhes antes de salvar — em marketplace, foto diferente do produto pode gerar reclamação.</p>}

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
      {previa.enlarged && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">A foto de origem é menor que o quadro e foi ampliada para caber. Isso não acrescenta detalhe — se tiver uma foto maior, prefira ela.</p>}
    </div>}

    <p className="mt-3 text-[10px] leading-relaxed text-ink-400">Fotos de fabricantes e lojas podem ter direitos de uso. Prefira as do fabricante do produto que você revende e confira se é o modelo e a cor certos antes de salvar.</p>
  </section>;
}
