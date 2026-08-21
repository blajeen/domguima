import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { ImportCatalogForm, SettingsForm } from "@/components/admin/SettingsForm";
import { getStoreSettings } from "@/lib/admin/data";

export default async function SettingsPage() {
  const settings = await getStoreSettings();
  return <><AdminPageHeader eyebrow="Dados da operacao" title="Configuracoes" description="Complete os dados reais da loja. Campos vazios nao devem ser inventados na vitrine." /><PanelCard><h2 className="mb-5 text-lg font-black">Loja e atendimento</h2><SettingsForm settings={settings} /></PanelCard><PanelCard className="mt-6"><h2 className="mb-2 text-lg font-black">Importacao inicial</h2><ImportCatalogForm /></PanelCard></>;
}
