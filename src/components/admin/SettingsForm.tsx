"use client";

import { useActionState } from "react";
import { importCurrentCatalogAction, saveSettingsAction } from "@/app/painel/actions";
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
    <Field name="pixDiscountPercent" label="Desconto no Pix (%)" value={settings.pixDiscountPercent} type="number" min="0" max="100" />
    <Field name="maxInstallments" label="Maximo de parcelas" value={settings.maxInstallments} type="number" min="1" />
    <label className={labelClass}>Distribuição de novos atendimentos
      <select name="leadDistributionMode" defaultValue={normalizeLeadDistributionMode(settings.leadDistributionMode)} className={fieldClass}>
        {distributionModes.map((mode) => <option key={mode} value={mode}>{LEAD_DISTRIBUTION_MODE_LABELS[mode]}</option>)}
      </select>
      <span className="mt-1 block font-normal text-ink-500">Vale para os atendimentos registrados a partir do site. Quem entra na distribuição é definido em “Atendentes”, abaixo.</span>
    </label>
  </div><FormMessage state={state} /><SubmitButton>Salvar configuracoes</SubmitButton></form>;
}

export function ImportCatalogForm() {
  const [state, action] = useActionState(importCurrentCatalogAction, {});
  return <form action={action} className="space-y-3"><p className="text-sm leading-relaxed text-ink-600">Importa categorias, produtos e referencias das fotos atuais. Registros existentes nao sao sobrescritos.</p><label className={labelClass}>Digite IMPORTAR para confirmar<input name="confirmation" required className={fieldClass} /></label><FormMessage state={state} /><SubmitButton pendingLabel="Importando...">Importar catalogo atual</SubmitButton></form>;
}

function Field({ name, label, value, className = "", ...props }: { name: keyof StoreSettings; label: string; value: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={`${labelClass} ${className}`}>{label}<input name={name} defaultValue={value} className={fieldClass} {...props} /></label>; }
