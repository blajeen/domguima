import { z } from "zod";
import { PANEL_ORDER_CHANNELS, type TrafficSource } from "./types";
import { isTrafficSource } from "@/lib/services/origem";
import { isValidCPF, onlyDigits } from "@/lib/utils/validators";

export const orderInput = z.object({
  saleMode: z.enum(["delivery", "counter"]).default("delivery"),
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/),
  sellerId: z.string().trim().min(1).max(80),
  customer: z.object({
    name: z.string().trim().min(3).max(140),
    cpf: z.string().transform(onlyDigits).refine(value => !value || isValidCPF(value), "CPF inválido."),
    phone: z.string().trim().max(30),
    cep: z.string().transform(onlyDigits),
    street: z.string().trim().max(180),
    number: z.string().trim().max(30),
    complement: z.string().trim().max(100),
    neighborhood: z.string().trim().max(100),
    city: z.string().trim().max(100),
    state: z.string().trim().max(2).transform((value) => value.toUpperCase()),
  }),
  notes: z.string().trim().max(500),
  channel: z.enum(PANEL_ORDER_CHANNELS, { error: "Escolha onde a venda foi fechada." }),
  // Qualquer origem conhecida passa aqui; a action restringe às do painel, mais
  // a do atendimento de origem (um cliente que veio da Shopee continua Shopee).
  source: z.custom<TrafficSource>(isTrafficSource, { error: "Escolha como o cliente chegou até a loja." }),
  // Atendimento de onde o pedido saiu ("Lançar pedido" na tela de Atendimento).
  leadId: z.string().trim().max(80).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().max(120).nullable().optional(),
    quantity: z.number().int().min(1).max(10_000),
    expectedStock: z.number().int().min(0),
    unitPriceCents: z.number().int().positive().max(100_000_000),
  })).min(1).max(100),
}).superRefine((value, context) => {
  if (value.saleMode !== "delivery") return;
  for (const field of ["cpf", "cep", "street", "number", "neighborhood", "city", "state"] as const) {
    const valid = field === "cpf" ? isValidCPF(value.customer.cpf) : field === "cep" ? value.customer.cep.length === 8 : field === "state" ? value.customer.state.length === 2 : field === "number" ? value.customer[field].length > 0 : value.customer[field].length >= 2;
    if (!valid) context.addIssue({ code: "custom", path: ["customer", field], message: "Preencha CPF e endereço completos para entrega." });
  }
});
