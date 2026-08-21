import { company } from "@/config/site";

type TrustIconName = "truck" | "message" | "experience" | "shield" | "store";

export function TrustBar() {
  const years = completedYears(company.openedAt);
  const items: Array<{ icon: TrustIconName; title: string; text: string }> = [
    { icon: "experience", title: `${years} anos de experiência`, text: `Empresa ativa desde março de ${company.openedAt.slice(-4)}.` },
    { icon: "message", title: "Atendimento próximo", text: "Dúvidas e compra acompanhadas diretamente pelo WhatsApp." },
    { icon: "truck", title: "Envio para todo o Brasil", text: "Pedidos despachados de Minas Gerais." },
    { icon: "shield", title: "Dados protegidos", text: "Usados somente para processar seu pedido." },
    { icon: "store", title: "Reputação verificável", text: "Confira as avaliações no Google e na Shopee." },
  ];

  return (
    <section aria-label="Por que comprar na Dom Guima" className="border-b border-ink-100 bg-ink-50">
      <div className="site-shell py-5">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-5 lg:gap-6">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-800">
                <TrustIcon name={item.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight text-ink-900">{item.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrustIcon({ name }: { name: TrustIconName }) {
  const paths: Record<TrustIconName, string> = {
    truck: "M3 6h11v9H3zM14 9h3l3 3v3h-6zM6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    message: "M4 5.5h16v11H9l-4.5 3v-3H4z",
    experience: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2M18 4v4h4",
    shield: "M12 3 19 6v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6zM9 12l2 2 4-4",
    store: "M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6",
  };
  return <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden><path d={paths[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function completedYears(openedAt: string): number {
  const [day, month, year] = openedAt.split("/").map(Number);
  const today = new Date();
  let years = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) years -= 1;
  return years;
}
