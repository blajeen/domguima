"use client";

import { useRef, useState } from "react";
import { saveSellersAction } from "@/app/painel/actions";
import type { ActionState, SellerRecord } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

interface SellersFormProps {
  sellers: SellerRecord[];
  /** Pedidos por atendente: quem tem pedido so pode ser desativado, nunca removido. */
  orderCounts: Record<string, number>;
  /** Numero principal da loja, usado por quem nao tem WhatsApp proprio. */
  storeWhatsappDisplay: string;
}

/**
 * Lista editavel de atendentes — a mesma que o site mostra no dialogo do
 * WhatsApp e que o painel usa para assinar pedidos.
 *
 * Linhas existentes vem das props; linhas novas e remocoes ficam em estado
 * local ate o salvamento. Cada linha envia `sellerRow` (chave) + campos
 * `seller-<chave>-*`, porque checkbox desmarcado nao viaja no FormData e um
 * `getAll` por campo desalinharia as linhas.
 */
export function SellersForm({ sellers, orderCounts, storeWhatsappDisplay }: SellersFormProps) {
  const [feedback, setFeedback] = useState<ActionState>({});
  const [novas, setNovas] = useState<string[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const proximaChave = useRef(0);

  const existentes = sellers.filter((seller) => !removidos.includes(seller.id));
  // Muda a cada lista gravada: remonta so as linhas, para os campos mostrarem o
  // que o servidor normalizou (ex.: funcao vazia vira "Vendedor") sem apagar a
  // mensagem de feedback do formulario.
  const assinatura = sellers.map((seller) => [seller.id, seller.name, seller.role_label, seller.whatsapp_number ?? "", seller.whatsapp_display, seller.receives_leads, seller.active, seller.sort_order].join("|")).join("\n");

  async function salvar(formData: FormData) {
    const result = await saveSellersAction({}, formData);
    setFeedback(result);
    // Com sucesso a pagina re-renderiza com a lista gravada: as linhas novas
    // ja chegam como existentes e as removidas nao voltam.
    if (result.ok) { setNovas([]); setRemovidos([]); }
  }

  function adicionar() {
    setNovas((atual) => [...atual, `novo-${proximaChave.current++}`]);
  }

  return (
    <form action={salvar} className="space-y-4">
      <div key={assinatura} className="space-y-3">
        {existentes.map((seller) => (
          <SellerRow
            key={seller.id}
            rowKey={seller.id}
            seller={seller}
            defaultOrder={seller.sort_order}
            orders={orderCounts[seller.id] ?? 0}
            storeWhatsappDisplay={storeWhatsappDisplay}
            onRemove={(orderCounts[seller.id] ?? 0) > 0 ? undefined : () => setRemovidos((atual) => [...atual, seller.id])}
          />
        ))}
        {novas.map((chave, index) => (
          <SellerRow
            key={chave}
            rowKey={chave}
            defaultOrder={existentes.length + index}
            orders={0}
            storeWhatsappDisplay={storeWhatsappDisplay}
            onRemove={() => setNovas((atual) => atual.filter((item) => item !== chave))}
          />
        ))}
        {existentes.length + novas.length === 0 && <p className="py-6 text-center text-sm text-ink-500">Nenhum atendente na lista. Adicione pelo menos um.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={adicionar} className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800 hover:border-gold-400">+ Adicionar atendente</button>
        <SubmitButton pendingLabel="Salvando...">Salvar atendentes</SubmitButton>
      </div>
      <FormMessage state={feedback} />
    </form>
  );
}

function SellerRow({ rowKey, seller, defaultOrder, orders, storeWhatsappDisplay, onRemove }: {
  rowKey: string;
  seller?: SellerRecord;
  defaultOrder: number;
  orders: number;
  storeWhatsappDisplay: string;
  onRemove?: () => void;
}) {
  const campo = (nome: string) => `seller-${rowKey}-${nome}`;
  return (
    <fieldset className="grid gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1.1fr_1fr_90px] xl:items-end">
      <input type="hidden" name="sellerRow" value={rowKey} />
      {/* O id nunca muda depois de criado: e ele que esta gravado nos pedidos. */}
      {seller && <input type="hidden" name={campo("id")} value={seller.id} />}
      <label className={labelClass}>Nome<input name={campo("name")} defaultValue={seller?.name ?? ""} required maxLength={80} className={fieldClass} /></label>
      <label className={labelClass}>Função (aparece no site)<input name={campo("roleLabel")} defaultValue={seller?.role_label ?? "Vendedor"} placeholder="Vendedor" maxLength={40} className={fieldClass} /></label>
      <label className={labelClass}>WhatsApp (só números, com 55 e DDD)<input name={campo("whatsappNumber")} defaultValue={seller?.whatsapp_number ?? ""} placeholder={`Vazio = número da loja ${storeWhatsappDisplay}`} inputMode="numeric" className={fieldClass} /></label>
      <label className={labelClass}>Número exibido<input name={campo("whatsappDisplay")} defaultValue={seller?.whatsapp_display ?? ""} placeholder="Vazio = formatado" maxLength={30} className={fieldClass} /></label>
      <label className={labelClass}>Ordem<input name={campo("sortOrder")} type="number" min="0" max="999" defaultValue={defaultOrder} className={fieldClass} /></label>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 xl:col-span-5">
        <label className="text-xs font-semibold"><input name={campo("active")} type="checkbox" defaultChecked={seller?.active ?? true} className="mr-2 accent-gold-500" />Ativo</label>
        <label className="text-xs font-semibold"><input name={campo("receivesLeads")} type="checkbox" defaultChecked={seller?.receives_leads ?? true} className="mr-2 accent-gold-500" />Recebe atendimentos do site</label>
        <span className="text-xs text-ink-500">
          {seller ? `Identificador: ${seller.id} · ${orders} pedido(s)` : "Novo — o identificador sai do nome"}
        </span>
        {onRemove
          ? <button type="button" onClick={onRemove} className="ml-auto text-xs font-bold text-red-700 hover:underline">Remover</button>
          : <span className="ml-auto text-xs text-ink-400">Tem pedidos: só pode ser desativado</span>}
      </div>
    </fieldset>
  );
}
