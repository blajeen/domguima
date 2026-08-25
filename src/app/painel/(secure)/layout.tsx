import { AdminShell } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/admin/auth";

// O painel depende do cookie de sessão e nunca pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default async function SecurePanelLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  return <AdminShell ownerName={owner.name}>{children}</AdminShell>;
}
