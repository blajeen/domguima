"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { quickCartMessage, whatsappLink } from "@/lib/services/whatsapp";
import { useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

type DeliveryChoice = "local" | "combinar";

export function QuickCheckout() {
  const router = useRouter();
  const { items, ready, subtotal, clear } = useCart();
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState<DeliveryChoice>("local");
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

    window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
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

      <div className="mt-4 max-w-2xl">
        <span className="inline-flex rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-bold text-[#128C7E]">
          Compra assistida pelo vendedor
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Finalização rápida
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Ideal para quem está em Uberlândia. Informe apenas seu nome e envie o carrinho; entrega, pagamento e demais detalhes são combinados diretamente com o vendedor.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card sm:p-6">
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
                checked={delivery === "local"}
                onChange={() => setDelivery("local")}
                title="Entrega em Uberlândia"
                text="Informe só o bairro, se quiser."
              />
              <Choice
                checked={delivery === "combinar"}
                onChange={() => setDelivery("combinar")}
                title="Combinar com o vendedor"
                text="Retirada ou outra forma."
              />
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

          <button
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-[#20bd5a]"
          >
            Enviar pedido ao vendedor
            <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-ink-400">
            O WhatsApp abrirá com os produtos e valores já preenchidos. Nenhuma cobrança é feita pelo site.
          </p>
        </div>

        <aside className="h-fit rounded-card border border-ink-100 bg-white p-5 shadow-card lg:sticky lg:top-44">
          <h2 className="text-base font-extrabold text-ink-900">Seu carrinho</h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variant ?? ""}`} className="flex gap-3 py-3 first:pt-0">
                <Image src={item.image} alt="" width={52} height={52} className="size-13 rounded-lg border border-ink-100 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2-safe text-xs font-semibold text-ink-700">{item.quantity}x {item.name}</p>
                  {item.variant && <p className="text-[11px] text-ink-400">{item.variant}</p>}
                  <p className="mt-1 text-xs font-extrabold text-ink-900">{formatPrice(item.price * item.quantity)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-4 text-lg font-extrabold text-ink-900">
            <span>Total</span><span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-400">Frete combinado com o vendedor.</p>
          <Link href="/checkout" className="mt-4 block text-center text-sm font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-800">
            Prefiro o checkout completo
          </Link>
        </aside>
      </form>
    </div>
  );
}

function Choice({ checked, onChange, title, text }: { checked: boolean; onChange: () => void; title: string; text: string }) {
  return (
    <label className={`cursor-pointer rounded-xl border p-3 transition ${checked ? "border-gold-500 bg-gold-50 ring-1 ring-gold-300" : "border-ink-200 hover:border-ink-300"}`}>
      <input type="radio" name="delivery" checked={checked} onChange={onChange} className="sr-only" />
      <span className="block text-sm font-bold text-ink-800">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-500">{text}</span>
    </label>
  );
}
