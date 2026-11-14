import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SettingsWorkspace } from "@/components/admin/SettingsWorkspace";
import { whatsapp } from "@/config/site";
import { getSellerOrderCounts, getSellers, getStoreSettings } from "@/lib/admin/data";
import { sortSellers } from "@/lib/admin/sellers";

export default async function SettingsPage() {
  const [settings, sellers, orderCounts] = await Promise.all([getStoreSettings(), getSellers(), getSellerOrderCounts()]);
  return <>
    <AdminPageHeader eyebrow="Dados da operacao" title="Configuracoes" description="Complete os dados reais da loja. Campos vazios nao devem ser inventados na vitrine." />
    <SettingsWorkspace settings={settings} sellers={sortSellers(sellers)} orderCounts={orderCounts} storeWhatsappDisplay={settings.whatsappDisplay || whatsapp.display} />
  </>;
}
