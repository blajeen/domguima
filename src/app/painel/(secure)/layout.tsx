import { AdminShell } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/admin/auth";

export default async function SecurePanelLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  return <AdminShell ownerName={owner.name}>{children}</AdminShell>;
}
