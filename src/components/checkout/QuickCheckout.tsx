"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { contactsFor, quickCartMessage, whatsappLink } from "@/lib/services/whatsapp";
import { lineKey, useCart } from "@/lib/store/cart";
import { CartTotals } from "@/components/cart/CartTotals";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, textLinkStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";

type DeliveryChoice = "local" | "combinar";

const sellers = contactsFor();

export function QuickCheckout() {
  const router = useRouter();
  const { items, ready, subtotal, savings, clear } = useCart();
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState<DeliveryChoice>("local");
  const [sellerId, setSellerId] = useState(sellers[0].id);
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (ready && items.length === 0 && !submitted) router.replace("/carrinho");
  }, [items.length, ready, router, submitted]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Informe seu nome para o vendedor identificar o pedido.");
      return;
    }

    const message = quickCartMessage(
      items.map((item) => ({
        name: item.variant ? `${item.name} (${item.variant})` : item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal,
      {
        name: name.trim(),
        delivery: delivery === "local" ? "Entrega em Uberlândia" : "Retirada ou entrega a combinar",
        neighborhood: neighborhood.trim(),
        notes: notes.trim(),
      },
    );

    const seller = sellers.find((contact) => contact.id === sellerId) ?? sellers[0];
    window.open(whatsappLink(message, seller.number), "_blank", "noopener,noreferrer");
    setSubmitted(true);
    clear();
    router.push("/pedido-enviado");
  }

  if (!ready || items.length === 0) {
    return <div className="site-shell py-16"><div className="skeleton mx-auto h-72 max-w-5xl rounded-card" /></div>;
  }

  return (
    <div className="site-shell py-6">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Carrinho", href: "/carrinho" },
          { label: "Pedido rápido" },
        ]}
        siteUrl={site.url}
      />

      {/* Título sem rótulo acima, como no /checkout; o parágrafo já diz que o
          vendedor combina o resto. */}
      <div className="mt-4 max-w-2xl">
        <h1 className="text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
          Finalização rápida
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Ideal para quem está em Uberlândia. Informe apenas seu nome e envie o carrinho; entrega, pagamento e demais detalhes são combinados diretamente com o vendedor.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="rounded-card border border-fio bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-ink-900">Só o essencial</h2>
          <p className="mt-1 text-sm text-ink-500">Sem cadastro, CPF, endereço completo ou dados de cartão.</p>

          <label className="mt-5 block text-sm font-bold text-ink-700">
            Seu nome <span className="text-promo">*</span>
            <input
              value={name}
              onChange={(event) => { setName(event.target.value); setError(""); }}
              autoComplete="name"
              autoFocus
              placeholder="Como o vendedor pode chamar você?"
              className="mt-2 w-full rounded-xl border border-ink-200 px-4 py-3 text-base text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-ink-700">Como prefere receber?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Choice
                name="delivery"
                checked={delivery === "local"}
                onChange={() => setDelivery("local")}
                title="Entrega em Uberlândia"
                text="Informe só o bairro, se quiser."
              />
              <Choice
                name="delivery"
                checked={delivery === "combinar"}
                onChange={() => setDelivery("combinar")}
                title="Combinar com o vendedor"
                text="Retirada ou outra forma."
              />
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-ink-700">Enviar o pedido para quem?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {sellers.map((contact) => (
                <Choice
                  key={contact.id}
                  name="seller"
                  checked={sellerId === contact.id}
                  onChange={() => setSellerId(contact.id)}
                  title={contact.name}
                  text={`${contact.role} · ${contact.display}`}
                />
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-bold text-ink-700">
            Bairro <span className="font-normal text-ink-400">(opcional)</span>
            <input
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              placeholder="Ex.: Santa Mônica"
              className="mt-2 w-full rounded-xl border border-ink-200 px-4 py-3 text-base text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200"
            />
          </label>

          <label className="mt-5 block text-sm font-bold text-ink-700">
            Observação <span className="font-normal text-ink-400">(opcional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Horário, dúvida ou outra informação para o vendedor"
              className="mt-2 w-full resize-y rounded-xl border border-ink-200 px-4 py-3 text-base text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-200"
            />
          </label>

          {error && <p role="alert" className="mt-3 text-sm font-semibold text-promo">{error}</p>}

          <Button type="submit" variant="whatsapp" size="lg" fullWidth className="mt-5">
            <Icon name="whatsapp" />
            Enviar pedido ao vendedor
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-ink-400">
            O WhatsApp abrirá com os produtos e valores já preenchidos. Nenhuma cobrança é feita pelo site.
          </p>
        </div>

        <aside className="h-fit rounded-card border border-fio bg-white p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <h2 className="text-base font-bold text-grafite-900">Seu carrinho</h2>
          <ul className="mt-2 divide-y divide-fio">
            {items.map((item) => (
              <li key={lineKey(item)} className="flex gap-3 py-3">
                <span className="relative size-13 shrink-0 overflow-hidden rounded-card border border-fio bg-white">
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="52px" className="object-contain p-0.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2-safe text-xs font-medium text-ink-700">
                    <span className="font-semibold tabular-nums text-grafite-900">{item.quantity}x</span> {item.name}
                  </p>
                  {item.variant && <p className="text-xs text-ink-500">{item.variant}</p>}
                  <PriceTag
                    size="compacto"
                    className="mt-1"
                    cents={item.price * item.quantity}
                    oldCents={item.oldPrice ? item.oldPrice * item.quantity : undefined}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-fio pt-3">
            <CartTotals
              items={items}
              subtotal={subtotal}
              savings={savings}
              shipping="Combinado com o vendedor"
              showSubtotal={false}
            />
          </div>
          <div className="mt-3 text-center">
            <Link href="/checkout" className={textLinkStyles}>
              Prefiro o checkout completo
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}

/** Mesma opção marcável das formas de pagamento do /checkout: rádio à vista (e com foco visível), grafite quando escolhida. */
function Choice({ name, checked, onChange, title, text }: { name: string; checked: boolean; onChange: () => void; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 text-sm transition-colors duration-(--duracao-toque) ${checked ? "border-grafite-900 bg-papel text-grafite-900" : "border-ink-200 hover:border-grafite-700"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 accent-grafite-900" />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-500">{text}</span>
      </span>
    </label>
  );
}
