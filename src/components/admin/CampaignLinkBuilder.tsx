"use client";

import { useId, useRef, useState } from "react";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/admin/types";
// origem-regras (e nao origem.ts): a mesma classificacao do servidor, sem o zod.
import { classifyTrafficSource } from "@/lib/services/origem-regras";
import { CAMPAIGN_REF_MAX } from "@/lib/services/whatsapp";
import { normalize } from "@/lib/utils/format";
import { fieldClass, labelClass } from "./FormControls";

export interface LinkDestinationGroup {
  label: string;
  options: Array<{ label: string; path: string }>;
}

/** Onde o link sera divulgado. O valor vai em `utm_source`. */
const FONTES = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "google", label: "Google" },
  { value: "outro", label: "Outro (digite abaixo)" },
] as const;

/** Formato da divulgacao. O valor vai em `utm_medium`. */
const MEIOS = [
  { value: "bio", label: "Link da bio" },
  { value: "stories", label: "Stories" },
  { value: "post", label: "Publicação" },
  { value: "anuncio", label: "Anúncio pago" },
  { value: "status", label: "Status do WhatsApp" },
  { value: "grupo", label: "Grupo ou lista de transmissão" },
  { value: "email", label: "E-mail" },
  { value: "impresso", label: "Panfleto ou QR code" },
  { value: "", label: "Sem formato" },
] as const;

/**
 * "Promoção de Natal!" → "promocao-de-natal": o nome da campanha vira parte da
 * URL e do relatório, e maiúscula, acento e espaço criariam duas campanhas
 * diferentes para a mesma divulgação. O corte acontece antes de tirar os
 * hífens das pontas, para o nome nunca terminar em "-".
 */
function slug(texto: string, max = 60): string {
  return normalize(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, max).replace(/-+$/, "");
}

/**
 * Gerador de links com UTM — o equivalente aos "links da bio" do iGest, sem
 * encurtador nem serviço externo.
 *
 * O link aponta para uma página da loja com `utm_source`, `utm_medium`,
 * `utm_campaign` e `utm_content`. Quem entra por ele tem a origem anotada pela
 * captura do site, e os atendimentos e pedidos dessa pessoa aparecem na
 * campanha certa no relatório de tráfego. Sem isso, o tráfego do app do
 * Instagram e do WhatsApp chega sem referrer e soma como "Direto".
 */
export function CampaignLinkBuilder({ siteUrl, destinations }: { siteUrl: string; destinations: LinkDestinationGroup[] }) {
  const id = useId();
  const [destino, setDestino] = useState("/");
  const [fonte, setFonte] = useState<(typeof FONTES)[number]["value"]>("instagram");
  const [fonteLivre, setFonteLivre] = useState("");
  const [meio, setMeio] = useState<(typeof MEIOS)[number]["value"]>("bio");
  const [campanha, setCampanha] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [aviso, setAviso] = useState("");
  const saida = useRef<HTMLInputElement>(null);

  const utmSource = fonte === "outro" ? slug(fonteLivre) : fonte;
  // Mesmo teto do "(ref. ...)" da mensagem do WhatsApp: o atendente recebe
  // exatamente o nome que aparece no relatório e na busca de pedidos.
  const utmCampaign = slug(campanha, CAMPAIGN_REF_MAX);
  const utmContent = slug(conteudo);
  const completo = Boolean(utmSource && utmCampaign);

  const params = new URLSearchParams();
  if (utmSource) params.set("utm_source", utmSource);
  if (meio) params.set("utm_medium", meio);
  if (utmCampaign) params.set("utm_campaign", utmCampaign);
  if (utmContent) params.set("utm_content", utmContent);
  const query = params.toString();
  const link = `${siteUrl.replace(/\/+$/, "")}${destino}${query ? `?${query}` : ""}`;
  const noRelatorio = TRAFFIC_SOURCE_LABELS[classifyTrafficSource({ utm_source: utmSource })];

  async function copiar() {
    if (!completo) return;
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado. Cole na bio, no post ou no anúncio.");
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): deixa
      // o link selecionado para o Ctrl+C.
      saida.current?.select();
      setAviso("Não foi possível copiar sozinho: o link está selecionado, use Ctrl+C.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <label className={`${labelClass} lg:col-span-2`}>
        Página de destino
        <select value={destino} onChange={(event) => { setDestino(event.target.value); setAviso(""); }} className={fieldClass}>
          {destinations.map((grupo) => (
            <optgroup key={grupo.label} label={grupo.label}>
              {grupo.options.map((opcao) => <option key={opcao.path} value={opcao.path}>{opcao.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Onde o link vai ser divulgado
        <select value={fonte} onChange={(event) => { setFonte(event.target.value as typeof fonte); setAviso(""); }} className={fieldClass}>
          {FONTES.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Formato
        <select value={meio} onChange={(event) => { setMeio(event.target.value as typeof meio); setAviso(""); }} className={fieldClass}>
          {MEIOS.map((opcao) => <option key={opcao.value || "nenhum"} value={opcao.value}>{opcao.label}</option>)}
        </select>
      </label>

      {fonte === "outro" && (
        <label className={`${labelClass} lg:col-span-2`}>
          Nome da origem
          <input value={fonteLivre} onChange={(event) => { setFonteLivre(event.target.value); setAviso(""); }} maxLength={60} placeholder="Ex.: tiktok, parceiro-joao, radio" className={fieldClass} />
        </label>
      )}

      <label className={labelClass}>
        Nome da campanha <span className="text-red-600">*</span>
        <input value={campanha} onChange={(event) => { setCampanha(event.target.value); setAviso(""); }} maxLength={80} placeholder="Ex.: Promoção de Natal" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Conteúdo <span className="font-normal text-ink-400">(opcional)</span>
        <input value={conteudo} onChange={(event) => { setConteudo(event.target.value); setAviso(""); }} maxLength={60} placeholder="Ex.: video-air-fryer" className={fieldClass} />
      </label>

      <div className="lg:col-span-2">
        <label htmlFor={`${id}-link`} className="block text-xs font-bold text-ink-600">Link pronto</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input id={`${id}-link`} ref={saida} readOnly value={completo ? link : ""} placeholder="Escolha a origem e dê um nome à campanha" className={`${fieldClass.replace("text-sm", "text-xs")} font-mono`} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={() => void copiar()} disabled={!completo} className="shrink-0 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            Copiar link
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          {completo
            ? <>No relatório, quem entrar por este link aparece como <strong>{noRelatorio}</strong>, na campanha <strong>{utmCampaign}</strong>. No WhatsApp, a mensagem do cliente chega com “(ref. {utmCampaign})”.</>
            : `O nome da campanha vira o código do link: acentos e espaços são trocados automaticamente, e nomes longos ficam com ${CAMPAIGN_REF_MAX} caracteres.`}
        </p>
        {aviso && <p role="status" className="mt-2 text-xs font-bold text-green-700">{aviso}</p>}
      </div>
    </div>
  );
}
