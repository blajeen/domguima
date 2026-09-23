import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { SellersForm } from "@/components/admin/SellersForm";
import { ImportCatalogForm, SettingsForm } from "@/components/admin/SettingsForm";
import { whatsapp } from "@/config/site";
import { getSellerOrderCounts, getSellers, getStoreSettings } from "@/lib/admin/data";
import { sortSellers } from "@/lib/admin/sellers";

export default async function SettingsPage() {
  const [settings, sellers, orderCounts] = await Promise.all([getStoreSettings(), getSellers(), getSellerOrderCounts()]);
  return <>
    <AdminPageHeader eyebrow="Dados da operacao" title="Configuracoes" description="Complete os dados reais da loja. Campos vazios nao devem ser inventados na vitrine." />
    <PanelCard><h2 className="mb-5 text-lg font-black">Loja e atendimento</h2><SettingsForm settings={settings} /></PanelCard>
    <PanelCard className="mt-6">
      <h2 className="text-lg font-black">Atendentes</h2>
      <p className="mb-5 mt-1 text-sm text-ink-500">Quem aparece para o cliente em “Com quem você quer falar?” e quem assina os pedidos no painel — a mesma lista. Sem WhatsApp próprio, o atendente usa o número principal da loja.</p>
      <SellersForm sellers={sortSellers(sellers)} orderCounts={orderCounts} storeWhatsappDisplay={settings.whatsappDisplay || whatsapp.display} />
    </PanelCard>
    <PanelCard className="mt-6"><h2 className="mb-2 text-lg font-black">Importacao inicial</h2><ImportCatalogForm /></PanelCard>
  </>;
}
