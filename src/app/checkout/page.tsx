"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { site } from "@/config/site";
import { isPaymentConfigured, PAYMENT_METHOD_LABELS } from "@/lib/services/payments";
import {
  BRAZILIAN_STATES,
  formatCep,
  isValidCep,
  lookupCep,
} from "@/lib/services/shipping";
import { whatsappLink } from "@/lib/services/whatsapp";
import { useCart } from "@/lib/store/cart";
import { formatPrice, formatWeight } from "@/lib/utils/format";
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
};

type Errors = Partial<Record<keyof FormState, string>>;

/**
 * CHECKOUT.
 *
 * Coleta os dados reais do pedido, valida CPF/CNPJ de verdade e preenche o
 * endereço pelo CEP (ViaCEP, integração real e funcionando).
 *
 * Pagamento: enquanto `getPaymentProvider()` devolver null, o pedido é
 * encaminhado pelo WhatsApp — que é como a loja já vende. Não simulamos
 * cobrança, não geramos Pix falso e não pedimos dado de cartão sem gateway.
 * Ligando um gateway, esta tela ganha o passo de pagamento sem reescrita.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { items, ready, subtotal, savings, totalWeight, clear } = useCart();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const [cepMessage, setCepMessage] = useState("");

  const paymentReady = isPaymentConfigured();

  // Carrinho vazio não tem checkout: manda de volta para a home.
  useEffect(() => {
    if (ready && items.length === 0) router.replace("/carrinho");
  }, [ready, items.length, router]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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

    setErrors(next);
    if (Object.keys(next).length > 0) {
      document
        .querySelector(`[data-field="${Object.keys(next)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function orderSummary(): string {
    const lines = items.map(
      (i) =>
        `• ${i.quantity}x ${i.variant ? `${i.name} (${i.variant})` : i.name} — ${formatPrice(i.price * i.quantity)}`,
    );

    return [
      "*NOVO PEDIDO — SITE DOM GUIMA*",
      "",
      "*Itens*",
      ...lines,
      "",
      `*Subtotal:* ${formatPrice(subtotal)}`,
      savings > 0 ? `*Desconto:* ${formatPrice(savings)}` : "",
      `*Peso estimado:* ${formatWeight(totalWeight)}`,
      "",
      "*Dados do cliente*",
      `Nome: ${form.name}`,
      `CPF/CNPJ: ${form.document}`,
      `Telefone: ${form.phone}`,
      `E-mail: ${form.email}`,
      "",
      "*Endereço de entrega*",
      `${form.street}, ${form.number}${form.complement ? ` — ${form.complement}` : ""}`,
      `${form.neighborhood} — ${form.city}/${form.state}`,
      `CEP: ${form.cep}`,
      form.notes ? `\n*Observações:* ${form.notes}` : "",
      "",
      "Aguardo a confirmação do frete e das formas de pagamento.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    window.open(whatsappLink(orderSummary()), "_blank", "noopener,noreferrer");
    clear();
    router.push("/pedido-enviado");
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

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Finalizar pedido
      </h1>

      <form
        onSubmit={onSubmit}
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
              <p className="text-sm font-semibold text-ink-900">
                🚚 Frete a combinar
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                O cálculo automático de frete ainda não está ativo. Assim que
                recebermos o pedido, confirmamos o valor e o prazo pelo WhatsApp
                — antes de qualquer cobrança.
              </p>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-ink-900">
                Formas de pagamento
              </p>
              {paymentReady ? (
                <p className="mt-1 text-sm text-ink-600">
                  Escolha a forma de pagamento na próxima etapa.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    Combinamos o pagamento junto com o frete. Trabalhamos com{" "}
                    {Object.values(PAYMENT_METHOD_LABELS)
                      .join(", ")
                      .replace(/, ([^,]*)$/, " e $1")}
                    .
                  </p>
                  <p className="mt-2 text-xs text-ink-400">
                    Não pedimos dados de cartão por aqui.
                  </p>
                </>
              )}
            </div>

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

        <aside className="lg:sticky lg:top-44 lg:h-fit">
          <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-4 text-base font-extrabold text-ink-900">
              Resumo
            </h2>

            <ul className="mb-4 max-h-64 space-y-3 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.variant ?? ""}`}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 text-ink-600">
                    <span className="font-semibold text-ink-900">
                      {item.quantity}x
                    </span>{" "}
                    <span className="line-clamp-2-safe">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink-900">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-ink-100 pt-3 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between font-semibold text-success">
                  <dt>Você economiza</dt>
                  <dd>−{formatPrice(savings)}</dd>
                </div>
              )}
              <div className="flex justify-between text-ink-600">
                <dt>Frete</dt>
                <dd className="text-ink-400">A combinar</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-lg font-extrabold text-ink-900">
                <dt>Total</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
            </dl>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-brand-700 px-6 py-3.5 text-base font-extrabold text-white transition-colors hover:bg-brand-600"
            >
              Enviar pedido pelo WhatsApp
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-ink-400">
              Ao enviar, abrimos uma conversa com o resumo do seu pedido. Você
              confirma tudo antes de pagar.
            </p>

            <Link
              href="/carrinho"
              className="mt-3 block text-center text-sm font-medium text-ink-500 transition-colors hover:text-ink-800"
            >
              Voltar ao carrinho
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
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
    <section className="rounded-card border border-ink-100 bg-white p-5 shadow-card sm:p-6">
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
