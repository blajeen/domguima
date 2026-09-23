"use client";

import { useActionState, useState } from "react";
import { importCurrentCatalogAction, saveSettingsAction } from "@/app/painel/actions";
import { lerParcelamento, MAX_PARCELAS, parcelamentoMaximo, simularParcela, validarTabelaDigitada, type ParcelamentoDaLoja } from "@/lib/catalog/parcelamento";
import { formatPrice } from "@/lib/utils/format";
import { normalizeLeadDistributionMode } from "@/lib/admin/sellers";
import { LEAD_DISTRIBUTION_MODE_LABELS, type LeadDistributionMode, type StoreSettings } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

const distributionModes = Object.keys(LEAD_DISTRIBUTION_MODE_LABELS) as LeadDistributionMode[];

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, action] = useActionState(saveSettingsAction, {});
  return <form action={action} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    <Field name="supportEmail" label="E-mail de atendimento" value={settings.supportEmail} type="email" />
    <Field name="supportHours" label="Horario de atendimento" value={settings.supportHours} placeholder="Seg a sex, 9h as 18h" />
    <Field name="cnpj" label="CNPJ" value={settings.cnpj} />
    <Field name="fiscalAddress" label="Endereco fiscal" value={settings.fiscalAddress} />
    <Field name="whatsappDisplay" label="WhatsApp exibido" value={settings.whatsappDisplay} />
    <Field name="whatsappNumber" label="WhatsApp para os links (somente numeros)" value={settings.whatsappNumber} inputMode="numeric" />
    <Field name="instagramUrl" label="Instagram" value={settings.instagramUrl} type="url" />
    <Field name="shopeeUrl" label="Shopee" value={settings.shopeeUrl} type="url" />
    <Field name="googleUrl" label="Perfil no Google" value={settings.googleUrl} type="url" />
    <Field name="googleRating" label="Nota no Google" value={settings.googleRating} />
    <Field name="googleRatingCount" label="Quantidade de avaliacoes" value={settings.googleRatingCount} type="number" />
    <Field name="googleVerifiedAt" label="Data da conferencia" value={settings.googleVerifiedAt} type="date" />
    <label className={labelClass}>Distribuição de novos atendimentos
      <select name="leadDistributionMode" defaultValue={normalizeLeadDistributionMode(settings.leadDistributionMode)} className={fieldClass}>
        {distributionModes.map((mode) => <option key={mode} value={mode}>{LEAD_DISTRIBUTION_MODE_LABELS[mode]}</option>)}
      </select>
      <span className="mt-1 block font-normal text-ink-500">Vale para os cliques de WhatsApp do site, o pedido rápido e os pedidos do checkout. No rodízio ou em “menos atendimentos em aberto”, o cliente vê um botão único e a loja escolhe quem recebe; no checkout completo o pedido já chega com o atendente definido (em “cliente escolhe”, ele entra na fila livre). Quem entra na distribuição é definido em “Atendentes”, abaixo. “Menos atendimentos em aberto” entrega para quem tem menos atendimentos nas etapas Novo, Em atendimento, Orçamento enviado e Aguardando pagamento — o mesmo número “em aberto” da tela de Atendimento — e desempata pelo rodízio. Para a conta ficar justa, marque cada conversa como Ganho ou Perdido em Atendimento ao encerrá-la (pedido confirmado ou cancelado fecha sozinho); um clique no WhatsApp que ninguém fechou continua contando como carga de quem o recebeu.</span>
    </label>
  </div><ParcelamentoFields inicial={lerParcelamento(settings)} /><FormMessage state={state} /><SubmitButton>Salvar configuracoes</SubmitButton></form>;
}

/**
 * Tabela da maquininha, um campo por quantidade de parcelas, e até quantas
 * vezes a chamada do preço anuncia. O site calcula o parcelado de todo produto
 * com elas: o lojista cadastra só o preço à vista.
 *
 * A validação é a mesma da ação (`validarTabelaDigitada`) e roda aqui antes do
 * envio: o React reinicia o formulário a cada envio, e um erro vindo do
 * servidor apagaria da tela as outras edições de Configurações. Campo com
 * problema ganha aria-invalid e a mensagem ao lado; o navegador não envia.
 */
function ParcelamentoFields({ inicial }: { inicial: ParcelamentoDaLoja }) {
  const [valores, setValores] = useState(() =>
    Array.from({ length: MAX_PARCELAS }, (_, indice) => (inicial.taxas[indice] === undefined ? "" : String(inicial.taxas[indice]).replace(".", ","))),
  );
  const [anunciar, setAnunciar] = useState(String(inicial.anunciarAte));
  const tabela = validarTabelaDigitada(valores);
  const taxas = tabela.ok ? tabela.taxas : [];
  const anunciarAte = Number(anunciar);
  const erroDoAnuncio = tabela.ok && taxas.length >= 2 && (!Number.isInteger(anunciarAte) || anunciarAte < 2 || anunciarAte > taxas.length)
    ? `Escolha de 2 a ${taxas.length} vezes (a última da tabela).`
    : "";
  const exemplo = 100_000;
  const chamada = tabela.ok && !erroDoAnuncio ? parcelamentoMaximo(exemplo, { taxas, anunciarAte }) : null;
  const ultima = tabela.ok && taxas.length >= 2 ? simularParcela(exemplo, taxas.length, taxas) : null;

  // id: o "Mudar as taxas" do cadastro de produto abre direto aqui.
  return <fieldset id="parcelamento" className="scroll-mt-6 rounded-xl border border-ink-200 p-4">
    <legend className="px-1 text-sm font-black text-ink-900">Parcelamento no cartão (taxas da maquininha)</legend>
    <p className="text-xs leading-relaxed text-ink-500">Cadastre nos produtos só o preço à vista (Pix ou dinheiro). O site calcula sozinho a parcela de cada produto com estas taxas, repassando a taxa ao cliente, e mostra a tabela completa na página do produto e no checkout. Taxa 0 aparece como “sem juros”. Para parcelar em menos vezes, apague os últimos campos, do fim para o começo.</p>
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {valores.map((valor, indice) => {
        const invalido = !tabela.ok && tabela.vezes === indice + 1;
        return <label key={indice} className="text-xs font-bold text-ink-700">{indice + 1}x
          <span className="relative block">
            <input
              name={`cardFee_${indice + 1}`} value={valor} inputMode="decimal" autoComplete="off"
              aria-label={`Taxa de ${indice + 1}x, em %`} aria-invalid={invalido || undefined} aria-describedby={invalido ? "parcelamento-status" : undefined}
              ref={(campo) => campo?.setCustomValidity(invalido && !tabela.ok ? tabela.mensagem : "")}
              onChange={(event) => setValores((atual) => atual.map((item, posicao) => (posicao === indice ? event.target.value : item)))}
              className={`${fieldClass} pr-7 ${invalido ? "border-red-500 ring-2 ring-red-100" : ""}`}
            />
            <span aria-hidden className="pointer-events-none absolute bottom-0 right-2.5 top-1.5 flex items-center text-ink-400">%</span>
          </span>
        </label>;
      })}
    </div>
    <label className={`${labelClass} mt-4 max-w-xs`}>Anunciar junto do preço: em até quantas vezes
      <input
        name="cardInstallmentsHeadline" value={anunciar} onChange={(event) => setAnunciar(event.target.value)}
        type="number" inputMode="numeric" min={2} max={taxas.length >= 2 ? taxas.length : undefined}
        aria-invalid={Boolean(erroDoAnuncio) || undefined} aria-describedby={erroDoAnuncio ? "parcelamento-status" : undefined}
        ref={(campo) => campo?.setCustomValidity(erroDoAnuncio)}
        className={`${fieldClass} ${erroDoAnuncio ? "border-red-500 ring-2 ring-red-100" : ""}`}
      />
      <span className="mt-1 block font-normal text-ink-500">É a frase “ou em até 12x de R$ ...” do card e da página. A tabela completa continua indo até a última vez preenchida.</span>
    </label>
    {!tabela.ok || erroDoAnuncio
      ? <p id="parcelamento-status" role="alert" className="mt-3 text-xs font-bold text-red-700">Não vai salvar: {!tabela.ok ? tabela.mensagem : erroDoAnuncio}</p>
      : <p id="parcelamento-status" className="mt-3 text-xs text-ink-600" aria-live="polite">{chamada && ultima
          ? <>Exemplo: um produto de {formatPrice(exemplo)} à vista aparece no site como <strong>em até {chamada.count}x de {formatPrice(chamada.value)}</strong>. A tabela vai de 1x a {ultima.vezes}x ({ultima.vezes}x de {formatPrice(ultima.parcela)}, total {formatPrice(ultima.total)}).</>
          : "Com só a taxa de 1x, o site não mostra parcelamento."}</p>}
  </fieldset>;
}

export function ImportCatalogForm() {
  const [state, action] = useActionState(importCurrentCatalogAction, {});
  return <form action={action} className="space-y-3"><p className="text-sm leading-relaxed text-ink-600">Importa categorias, produtos e referencias das fotos atuais. Registros existentes nao sao sobrescritos.</p><label className={labelClass}>Digite IMPORTAR para confirmar<input name="confirmation" required className={fieldClass} /></label><FormMessage state={state} /><SubmitButton pendingLabel="Importando...">Importar catalogo atual</SubmitButton></form>;
}

function Field({ name, label, value, className = "", ...props }: { name: keyof StoreSettings; label: string; value: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={`${labelClass} ${className}`}>{label}<input name={name} defaultValue={value} className={fieldClass} {...props} /></label>; }
