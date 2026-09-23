"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartTotals } from "@/components/cart/CartTotals";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, textLinkStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { site } from "@/config/site";
import { ORDER_PAYMENT_METHOD_LABELS, type OrderPaymentMethod } from "@/lib/admin/types";
import {
  BRAZILIAN_STATES,
  formatCep,
  isValidCep,
  lookupCep,
} from "@/lib/services/shipping";
import { lineKey, useCart } from "@/lib/store/cart";
import { lerOrigem } from "@/lib/store/origem-storage";
import {
  formatDocument,
  formatPhone,
  isValidDocument,
  isValidEmail,
  isValidPhone,
} from "@/lib/utils/validators";

interface FormState {
  name: string;
  document: string;
  phone: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
  paymentMethod: OrderPaymentMethod | "";
}

const EMPTY: FormState = {
  name: "",
  document: "",
  phone: "",
  email: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  notes: "",
  paymentMethod: "",
};

type Errors = Partial<Record<keyof FormState, string>>;

/**
 * CHECKOUT.
 *
 * Coleta os dados reais do pedido, valida CPF/CNPJ de verdade e preenche o
 * endereço pelo CEP (ViaCEP, integração real e funcionando).
 *
 * O checkout registra uma solicitação no site. A Dom Guima confirma
 * disponibilidade, frete e pagamento pelo WhatsApp antes de qualquer cobrança.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { items, ready, subtotal, savings, clear } = useCart();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const [cepMessage, setCepMessage] = useState("");
  const [sitePending, setSitePending] = useState(false);
  const [siteError, setSiteError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Carrinho vazio não tem checkout: manda de volta para a home.
  // `submitted` é essencial: ao concluir o pedido esvaziamos o carrinho, e sem
  // essa guarda este efeito dispararia e jogaria o cliente para /carrinho por
  // cima da confirmação — ele veria um carrinho vazio achando que falhou.
  useEffect(() => {
    if (ready && items.length === 0 && !submitted) router.replace("/carrinho");
  }, [ready, items.length, router, submitted]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "city" && f.paymentMethod === "cash_on_delivery" && !isUberlandia(value) ? { paymentMethod: "to_confirm" as const } : {}),
    }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onCepBlur() {
    if (!isValidCep(form.cep)) return;
    setCepStatus("loading");
    setCepMessage("");
    try {
      const address = await lookupCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: address.cep,
        street: address.street || f.street,
        neighborhood: address.neighborhood || f.neighborhood,
        city: address.city,
        state: address.state,
        paymentMethod: f.paymentMethod === "cash_on_delivery" && !isUberlandia(address.city) ? "to_confirm" : f.paymentMethod,
      }));
      setCepStatus("idle");
    } catch (error) {
      setCepStatus("error");
      setCepMessage((error as Error).message);
    }
  }

  function validate(): boolean {
    const next: Errors = {};
    if (form.name.trim().split(/\s+/).length < 2)
      next.name = "Informe nome e sobrenome.";
    if (!isValidDocument(form.document)) next.document = "CPF ou CNPJ inválido.";
    if (!isValidPhone(form.phone)) next.phone = "Informe o DDD e o número.";
    if (!isValidEmail(form.email)) next.email = "E-mail inválido.";
    if (!isValidCep(form.cep)) next.cep = "CEP inválido.";
    if (!form.street.trim()) next.street = "Informe a rua.";
    if (!form.number.trim()) next.number = "Informe o número.";
    if (!form.neighborhood.trim()) next.neighborhood = "Informe o bairro.";
    if (!form.city.trim()) next.city = "Informe a cidade.";
    if (!form.state) next.state = "Selecione o estado.";
    if (!form.paymentMethod) next.paymentMethod = "Escolha como deseja pagar.";
    if (form.paymentMethod === "cash_on_delivery" && !isUberlandia(form.city)) {
      next.paymentMethod = "Pagar na entrega está disponível somente para Uberlândia.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      document
        .querySelector(`[data-field="${Object.keys(next)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  async function onSiteSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate() || sitePending) return;
    setSitePending(true);
    setSiteError("");
    try {
      const response = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: `site-${crypto.randomUUID()}`,
          customer: {
            name: form.name,
            cpf: form.document,
            email: form.email,
            phone: form.phone,
            cep: form.cep,
            street: form.street,
            number: form.number,
            complement: form.complement,
            neighborhood: form.neighborhood,
            city: form.city,
            state: form.state,
          },
          notes: form.notes,
          paymentMethod: form.paymentMethod,
          deliveryMethod: isUberlandia(form.city) ? "uberlandia_delivery" : "shipping_to_confirm",
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, variant: item.variant, variantId: item.variantId })),
          // De onde o cliente chegou (Instagram, Google, campanha). Sem nada
          // guardado o campo nao vai, e a rota ainda tenta o cookie de origem.
          origem: lerOrigem() ?? undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; orderNumber?: string; orderId?: string };
      if (!response.ok || !data.orderNumber) throw new Error(data.message || "Nao foi possivel registrar o pedido.");
      setSubmitted(true);
      clear();
      // O id deixa o botao de WhatsApp da proxima tela falar com quem ja cuida do pedido.
      const pedido = data.orderId ? `&pedido=${encodeURIComponent(data.orderId)}` : "";
      router.push(`/pedido-enviado?tipo=site&numero=${encodeURIComponent(data.orderNumber)}${pedido}`);
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Nao foi possivel registrar o pedido agora.");
      setSitePending(false);
    }
  }

  if (!ready || items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="skeleton h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="site-shell py-6">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Carrinho", href: "/carrinho" },
          { label: "Finalizar pedido" },
        ]}
        siteUrl={site.url}
      />

      <h1 className="mt-4 text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
        Finalizar pedido
      </h1>

      <form
        onSubmit={onSiteSubmit}
        noValidate
        className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8"
      >
        <div className="space-y-6">
          <Card title="Seus dados" step={1}>
            <Grid>
              <Field
                label="Nome completo"
                name="name"
                value={form.name}
                error={errors.name}
                onChange={(v) => update("name", v)}
                autoComplete="name"
                span
              />
              <Field
                label="CPF ou CNPJ"
                name="document"
                value={form.document}
                error={errors.document}
                onChange={(v) => update("document", formatDocument(v))}
                inputMode="numeric"
              />
              <Field
                label="Telefone / WhatsApp"
                name="phone"
                value={form.phone}
                error={errors.phone}
                onChange={(v) => update("phone", formatPhone(v))}
                inputMode="tel"
                autoComplete="tel"
              />
              <Field
                label="E-mail"
                name="email"
                type="email"
                value={form.email}
                error={errors.email}
                onChange={(v) => update("email", v)}
                autoComplete="email"
                span
              />
            </Grid>
          </Card>

          <Card title="Endereço de entrega" step={2}>
            <Grid>
              <div data-field="cep">
                <Label htmlFor="cep">CEP</Label>
                <input
                  id="cep"
                  value={form.cep}
                  onChange={(e) => update("cep", formatCep(e.target.value))}
                  onBlur={onCepBlur}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  aria-invalid={Boolean(errors.cep)}
                  className={inputClass(Boolean(errors.cep))}
                />
                {cepStatus === "loading" && (
                  <p className="mt-1 text-xs text-ink-400">Buscando endereço…</p>
                )}
                {cepStatus === "error" && (
                  <p className="mt-1 text-xs text-promo">{cepMessage}</p>
                )}
                {errors.cep && cepStatus !== "error" && (
                  <p className="mt-1 text-xs text-promo">{errors.cep}</p>
                )}
                {cepStatus === "idle" && !errors.cep && (
                  <p className="mt-1 text-xs text-ink-400">
                    Preenchemos o endereço automaticamente.
                  </p>
                )}
              </div>

              <Field
                label="Rua / Avenida"
                name="street"
                value={form.street}
                error={errors.street}
                onChange={(v) => update("street", v)}
                autoComplete="address-line1"
              />
              <Field
                label="Número"
                name="number"
                value={form.number}
                error={errors.number}
                onChange={(v) => update("number", v)}
                inputMode="numeric"
              />
              <Field
                label="Complemento"
                name="complement"
                value={form.complement}
                onChange={(v) => update("complement", v)}
                optional
              />
              <Field
                label="Bairro"
                name="neighborhood"
                value={form.neighborhood}
                error={errors.neighborhood}
                onChange={(v) => update("neighborhood", v)}
              />
              <Field
                label="Cidade"
                name="city"
                value={form.city}
                error={errors.city}
                onChange={(v) => update("city", v)}
                autoComplete="address-level2"
              />
              <div data-field="state">
                <Label htmlFor="state">Estado</Label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  aria-invalid={Boolean(errors.state)}
                  className={inputClass(Boolean(errors.state))}
                >
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="mt-1 text-xs text-promo">{errors.state}</p>
                )}
              </div>
            </Grid>
          </Card>

          <Card title="Entrega e pagamento" step={3}>
            <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Icon name="caminhao" size={18} className="text-ink-500" />
                Frete a combinar
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                O cálculo automático de frete ainda não está ativo. Assim que
                recebermos o pedido, confirmamos o valor e o prazo pelo WhatsApp,
                antes de qualquer cobrança.
              </p>
            </div>

            <fieldset className="mt-4" data-field="paymentMethod">
              <legend className="text-sm font-semibold text-ink-900">
                Como você prefere pagar?
              </legend>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                Escolha uma preferência. A Dom Guima confirma o valor final e a forma de pagamento pelo WhatsApp antes de qualquer cobrança.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {paymentOptions(isUberlandia(form.city)).map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 text-sm transition-colors duration-(--duracao-toque) ${form.paymentMethod === option.value ? "border-grafite-900 bg-papel text-grafite-900" : "border-ink-200 hover:border-grafite-700"}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={form.paymentMethod === option.value}
                      onChange={() => update("paymentMethod", option.value)}
                      className="mt-0.5 accent-grafite-900"
                    />
                    <span>
                      <span className="block font-bold">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!isUberlandia(form.city) && (
                <p className="mt-2 text-xs font-semibold text-ink-500">
                  Para outras cidades, o pagamento fica a combinar com a loja.
                </p>
              )}
              {errors.paymentMethod && (
                <p className="mt-2 text-xs text-promo">{errors.paymentMethod}</p>
              )}
            </fieldset>

            <div className="mt-4">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Ponto de referência, horário de entrega, voltagem…"
                className={`${inputClass(false)} resize-y`}
              />
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:h-fit">
          <div className="rounded-card border border-fio bg-white p-5">
            <h2 className="mb-2 text-base font-bold text-grafite-900">
              Resumo
            </h2>

            <ul className="mb-3 max-h-64 divide-y divide-fio overflow-y-auto">
              {items.map((item) => (
                <li
                  key={lineKey(item)}
                  className="flex items-start justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 text-ink-700">
                    <span className="line-clamp-2-safe">
                      <span className="font-semibold tabular-nums text-grafite-900">
                        {item.quantity}x
                      </span>{" "}
                      {item.name}
                    </span>
                    {item.variant && (
                      <span className="mt-0.5 block text-xs text-ink-500">{item.variant}</span>
                    )}
                  </span>
                  <PriceTag
                    size="compacto"
                    className="shrink-0 items-end text-right"
                    cents={item.price * item.quantity}
                    oldCents={item.oldPrice ? item.oldPrice * item.quantity : undefined}
                  />
                </li>
              ))}
            </ul>

            <div className="border-t border-fio pt-3">
              <CartTotals
                items={items}
                subtotal={subtotal}
                savings={savings}
                shipping="A combinar"
              />
            </div>

            <div className="mt-5 rounded-card border border-fio bg-papel p-4">
              <p className="text-sm font-bold text-grafite-900">Pedido pelo site</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-700">
                Enviamos sua solicitação para a Dom Guima. O dono entra em contato pelo WhatsApp para confirmar o pedido, o frete, o pagamento e avisar quando ele for enviado.
              </p>
            </div>

            {/* Mesmo vermelho dos erros dos campos (`oferta` é só desconto). Sem
                fundo tingido: sobre ele este vermelho cairia abaixo de 4,5:1. */}
            {siteError && <p role="alert" className="mt-3 rounded-control border border-promo/40 px-3 py-2 text-sm font-semibold text-promo">{siteError}</p>}
            <Button
              type="submit"
              disabled={sitePending}
              size="lg"
              fullWidth
              className="mt-3"
            >
              {sitePending ? "Enviando pedido..." : "Enviar pedido"}
            </Button>

            <p className="mt-3 text-center text-xs leading-relaxed text-ink-500">
              Nenhum pagamento é cobrado nesta etapa. A confirmação será feita pelo WhatsApp.
            </p>

            <div className="mt-1 text-center">
              <Link href="/carrinho" className={textLinkStyles}>
                Voltar ao carrinho
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

function paymentOptions(isLocal: boolean): Array<{ value: OrderPaymentMethod; label: string; description: string }> {
  const options: Array<{ value: OrderPaymentMethod; label: string; description: string }> = [
    { value: "pix", label: ORDER_PAYMENT_METHOD_LABELS.pix, description: "A loja envia os dados pelo WhatsApp." },
    { value: "credit_card", label: ORDER_PAYMENT_METHOD_LABELS.credit_card, description: "Combinamos a cobrança com você." },
    { value: "debit_card", label: ORDER_PAYMENT_METHOD_LABELS.debit_card, description: "Disponibilidade confirmada pela loja." },
    { value: "boleto", label: ORDER_PAYMENT_METHOD_LABELS.boleto, description: "A combinar com a Dom Guima." },
    { value: "to_confirm", label: ORDER_PAYMENT_METHOD_LABELS.to_confirm, description: "Decidimos junto com frete e prazo." },
  ];
  if (isLocal) options.splice(4, 0, { value: "cash_on_delivery", label: ORDER_PAYMENT_METHOD_LABELS.cash_on_delivery, description: "Exclusivo para entregas em Uberlândia." });
  return options;
}

function isUberlandia(city: string): boolean {
  return city.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "uberlandia";
}

/* ── Peças do formulário ─────────────────────────────────────────────────── */

function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border px-3 py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:ring-2 ${
    hasError
      ? "border-promo focus:border-promo focus:ring-promo/20"
      : "border-ink-200 focus:border-gold-400 focus:ring-gold-400/20"
  }`;
}

function Card({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-fio bg-white p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-extrabold text-ink-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-xs text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-semibold text-ink-700"
    >
      {children}
      {optional && (
        <span className="ml-1 font-normal text-ink-400">(opcional)</span>
      )}
    </label>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  autoComplete,
  optional = false,
  span = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoComplete?: string;
  optional?: boolean;
  span?: boolean;
}) {
  return (
    <div data-field={name} className={span ? "sm:col-span-2" : undefined}>
      <Label htmlFor={name} optional={optional}>
        {label}
      </Label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputClass(Boolean(error))}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-promo">
          {error}
        </p>
      )}
    </div>
  );
}
