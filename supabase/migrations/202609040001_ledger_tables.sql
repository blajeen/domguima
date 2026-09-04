-- ============================================================================
-- FASE 2 — LIVRO-RAZAO: TABELAS E FUNCOES NOVAS (PURAMENTE ADITIVO)
-- ============================================================================
--
-- Esta migracao NAO altera nenhuma tabela, funcao ou dado que a aplicacao usa
-- hoje. Ela apenas cria estruturas novas e COPIA os pedidos que hoje moram
-- dentro de store_settings.settings.__operations.orders (JSONB).
--
-- O JSONB antigo permanece intacto. Enquanto a Fase 3 nao entrar no ar, o site
-- continua funcionando exatamente como antes e nada aqui e lido pelo app.
--
-- Rollback desta fase:
--   drop function if exists public.append_audit_log(jsonb);
--   drop function if exists public.append_inventory_movement(jsonb);
--   drop function if exists public.decrement_product_stock(text, integer);
--   drop function if exists public.update_sales_order_status(text, jsonb);
--   drop function if exists public.create_sales_order(jsonb);
--   drop function if exists public.next_order_number(timestamptz);
--   drop table if exists public.order_number_counters;
--   drop table if exists public.sales_orders;
--
-- Motivo desta mudanca: replace_catalog_state apaga e reinsere o estado
-- inteiro. Duas gravacoes simultaneas se sobrescreviam (pedidos sumiam e o
-- numero repetia), e o historico de estoque/auditoria era truncado no teto de
-- leitura do app a cada salvamento. Livro-razao passa a ser append-only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create table if not exists public.sales_orders (
  id text primary key,
  number text not null,
  request_id text,
  status text not null default 'pending',
  seller_id text not null default '',
  seller_name text not null default '',
  payment_method text,
  delivery_method text,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  total_units integer not null default 0,
  gross_total_cents integer not null default 0,
  discount_total_cents integer not null default 0,
  total_cents integer not null default 0,
  commission_total_cents integer not null default 0,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text
);

-- O numero e unico de verdade: e o que impede dois pedidos simultaneos de
-- receberem a mesma identificacao.
create unique index if not exists sales_orders_number_key on public.sales_orders(number);

-- request_id garante idempotencia (reenvio do mesmo pedido nao duplica).
-- Parcial porque pedidos antigos podem nao ter request_id.
create unique index if not exists sales_orders_request_id_key
  on public.sales_orders(request_id) where request_id is not null;

create index if not exists sales_orders_created_at_idx on public.sales_orders(created_at desc);
create index if not exists sales_orders_status_idx on public.sales_orders(status, created_at desc);
create index if not exists sales_orders_seller_idx on public.sales_orders(seller_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Numeracao atomica: DG-YYYYMMDD-NNN, reiniciando por dia em Sao Paulo
-- ---------------------------------------------------------------------------
create table if not exists public.order_number_counters (
  day date primary key,
  last_seq integer not null default 0
);

create or replace function public.next_order_number(p_created_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_day date;
  v_seq integer;
begin
  v_day := (p_created_at at time zone 'America/Sao_Paulo')::date;

  -- O insert-on-conflict-returning e atomico: duas transacoes simultaneas
  -- recebem sequencias diferentes, sem necessidade de lock explicito.
  insert into public.order_number_counters as c (day, last_seq)
  values (v_day, 1)
  on conflict (day) do update set last_seq = c.last_seq + 1
  returning c.last_seq into v_seq;

  return 'DG-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Criacao de pedido (append-only, idempotente por request_id)
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_order(p_order jsonb)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_request_id text := nullif(p_order->>'request_id', '');
  v_created_at timestamptz := coalesce(nullif(p_order->>'created_at', '')::timestamptz, now());
  v_row public.sales_orders;
begin
  -- Reenvio do mesmo pedido devolve o que ja existe, sem duplicar.
  if v_request_id is not null then
    select * into v_row from public.sales_orders where request_id = v_request_id;
    if found then return v_row; end if;
  end if;

  insert into public.sales_orders (
    id, number, request_id, status, seller_id, seller_name, payment_method, delivery_method,
    customer, items, total_units, gross_total_cents, discount_total_cents, total_cents,
    commission_total_cents, notes, created_by, created_at, cancelled_at, cancelled_by
  ) values (
    coalesce(nullif(p_order->>'id', ''), gen_random_uuid()::text),
    public.next_order_number(v_created_at),
    v_request_id,
    coalesce(nullif(p_order->>'status', ''), 'pending'),
    coalesce(p_order->>'seller_id', ''),
    coalesce(p_order->>'seller_name', ''),
    nullif(p_order->>'payment_method', ''),
    nullif(p_order->>'delivery_method', ''),
    coalesce(p_order->'customer', '{}'::jsonb),
    coalesce(p_order->'items', '[]'::jsonb),
    coalesce(nullif(p_order->>'total_units', '')::integer, 0),
    coalesce(nullif(p_order->>'gross_total_cents', '')::integer, 0),
    coalesce(nullif(p_order->>'discount_total_cents', '')::integer, 0),
    coalesce(nullif(p_order->>'total_cents', '')::integer, 0),
    coalesce(nullif(p_order->>'commission_total_cents', '')::integer, 0),
    coalesce(p_order->>'notes', ''),
    coalesce(p_order->>'created_by', ''),
    v_created_at,
    nullif(p_order->>'cancelled_at', '')::timestamptz,
    nullif(p_order->>'cancelled_by', '')
  )
  on conflict (request_id) where request_id is not null do nothing
  returning * into v_row;

  -- Corrida: outra transacao inseriu o mesmo request_id entre o select e o
  -- insert. Devolve o vencedor em vez de estourar erro.
  if v_row.id is null and v_request_id is not null then
    select * into v_row from public.sales_orders where request_id = v_request_id;
  end if;

  return v_row;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Atualizacao de status (confirmar / cancelar) — UPDATE direcionado
-- ---------------------------------------------------------------------------
create or replace function public.update_sales_order_status(p_id text, p_patch jsonb)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.sales_orders;
begin
  update public.sales_orders set
    status         = coalesce(nullif(p_patch->>'status', ''), status),
    seller_id      = coalesce(nullif(p_patch->>'seller_id', ''), seller_id),
    seller_name    = coalesce(nullif(p_patch->>'seller_name', ''), seller_name),
    cancelled_at   = case when p_patch ? 'cancelled_at'
                          then nullif(p_patch->>'cancelled_at', '')::timestamptz
                          else cancelled_at end,
    cancelled_by   = case when p_patch ? 'cancelled_by'
                          then nullif(p_patch->>'cancelled_by', '')
                          else cancelled_by end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Baixa de estoque atomica: nunca deixa negativo
-- ---------------------------------------------------------------------------
create or replace function public.decrement_product_stock(p_id text, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stock integer;
begin
  if p_qty <= 0 then
    raise exception 'Quantidade invalida: %', p_qty;
  end if;

  -- A condicao stock >= p_qty vive no proprio UPDATE: duas vendas simultaneas
  -- da ultima unidade nao passam as duas.
  update public.products
     set stock = stock - p_qty,
         last_sale_at = now(),
         updated_at = now()
   where id = p_id and stock >= p_qty
  returning stock into v_stock;

  -- NULL sinaliza estoque insuficiente (nenhuma linha atendeu a condicao).
  return v_stock;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Livro-razao append-only: movimentos e auditoria
-- ---------------------------------------------------------------------------
create or replace function public.append_inventory_movement(p_movement jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.inventory_movements (
    id, product_id, quantity_delta, stock_before, stock_after, reason, note,
    commission_percent, commission_cents, actor_id, created_at
  ) values (
    coalesce(nullif(p_movement->>'id', ''), gen_random_uuid()::text),
    p_movement->>'product_id',
    (p_movement->>'quantity_delta')::integer,
    (p_movement->>'stock_before')::integer,
    (p_movement->>'stock_after')::integer,
    coalesce(p_movement->>'reason', ''),
    nullif(p_movement->>'note', ''),
    coalesce(nullif(p_movement->>'commission_percent', '')::numeric, 0),
    coalesce(nullif(p_movement->>'commission_cents', '')::integer, 0),
    coalesce(p_movement->>'actor_id', ''),
    coalesce(nullif(p_movement->>'created_at', '')::timestamptz, now())
  )
  on conflict (id) do nothing;
end;
$fn$;

create or replace function public.append_audit_log(p_audit jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.audit_logs (
    id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at
  ) values (
    coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
    coalesce(p_audit->>'actor_id', ''),
    coalesce(p_audit->>'action', ''),
    coalesce(p_audit->>'entity_type', ''),
    coalesce(p_audit->>'entity_id', ''),
    p_audit->'before_data',
    p_audit->'after_data',
    coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
  )
  on conflict (id) do nothing;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- COPIA dos pedidos existentes (o JSONB de origem NAO e apagado)
-- ---------------------------------------------------------------------------
insert into public.sales_orders (
  id, number, request_id, status, seller_id, seller_name, payment_method, delivery_method,
  customer, items, total_units, gross_total_cents, discount_total_cents, total_cents,
  commission_total_cents, notes, created_by, created_at, cancelled_at, cancelled_by
)
select
  o->>'id',
  o->>'number',
  nullif(o->>'request_id', ''),
  coalesce(nullif(o->>'status', ''), 'pending'),
  coalesce(o->>'seller_id', ''),
  coalesce(o->>'seller_name', ''),
  nullif(o->>'payment_method', ''),
  nullif(o->>'delivery_method', ''),
  coalesce(o->'customer', '{}'::jsonb),
  coalesce(o->'items', '[]'::jsonb),
  coalesce(nullif(o->>'total_units', '')::integer, 0),
  coalesce(nullif(o->>'gross_total_cents', '')::integer, 0),
  coalesce(nullif(o->>'discount_total_cents', '')::integer, 0),
  coalesce(nullif(o->>'total_cents', '')::integer, 0),
  coalesce(nullif(o->>'commission_total_cents', '')::integer, 0),
  coalesce(o->>'notes', ''),
  coalesce(o->>'created_by', ''),
  coalesce(nullif(o->>'created_at', '')::timestamptz, now()),
  nullif(o->>'cancelled_at', '')::timestamptz,
  nullif(o->>'cancelled_by', '')
from public.store_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.settings->'__operations'->'orders') = 'array'
       then s.settings->'__operations'->'orders'
       else '[]'::jsonb end
) as o
where s.id = 'store'
  and nullif(o->>'id', '') is not null
  and nullif(o->>'number', '') is not null
on conflict (id) do nothing;

-- Continua a numeracao de onde os pedidos copiados pararam. Sem isto, o
-- proximo pedido voltaria para 001 e colidiria com um numero ja usado.
insert into public.order_number_counters (day, last_seq)
select
  (created_at at time zone 'America/Sao_Paulo')::date as day,
  max(coalesce(nullif(regexp_replace(number, '^DG-[0-9]{8}-', ''), '')::integer, 0)) as last_seq
from public.sales_orders
where number ~ '^DG-[0-9]{8}-[0-9]+$'
group by 1
on conflict (day) do update
  set last_seq = greatest(public.order_number_counters.last_seq, excluded.last_seq);

-- ---------------------------------------------------------------------------
-- Permissoes: mesmo padrao das funcoes existentes — so o service_role executa
-- ---------------------------------------------------------------------------
alter table public.sales_orders enable row level security;
alter table public.order_number_counters enable row level security;

revoke all on function public.next_order_number(timestamptz) from public, anon, authenticated;
revoke all on function public.create_sales_order(jsonb) from public, anon, authenticated;
revoke all on function public.update_sales_order_status(text, jsonb) from public, anon, authenticated;
revoke all on function public.decrement_product_stock(text, integer) from public, anon, authenticated;
revoke all on function public.append_inventory_movement(jsonb) from public, anon, authenticated;
revoke all on function public.append_audit_log(jsonb) from public, anon, authenticated;

grant execute on function public.next_order_number(timestamptz) to service_role;
grant execute on function public.create_sales_order(jsonb) to service_role;
grant execute on function public.update_sales_order_status(text, jsonb) to service_role;
grant execute on function public.decrement_product_stock(text, integer) to service_role;
grant execute on function public.append_inventory_movement(jsonb) to service_role;
grant execute on function public.append_audit_log(jsonb) to service_role;
