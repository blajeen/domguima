-- ============================================================================
-- ORIGEM DO PEDIDO (controle de trafego first-party)
-- ============================================================================
--
-- Ate aqui o pedido nao dizia de onde o cliente veio nem onde a venda foi
-- fechada. O canal do lancamento em lote (SHOPEE, RETIRADA...) so existia como
-- texto nas notas ("Lancamento em lote · SHOPEE 04-09 · PAGO") e o pedido do
-- site so tinha o created_by = 'public-site'. Sem isso nao ha relatorio por
-- origem, por campanha nem por canal.
--
-- Esta migration acrescenta a sales_orders:
--
--   channel       onde a venda aconteceu: site | whatsapp | store | shopee |
--                 mercado_livre | magalu | other. '' = nao informado.
--   source        como o cliente chegou: direct | instagram | facebook |
--                 whatsapp | google | shopee | mercado_livre | magalu |
--                 referral | store | other. '' = nao informado.
--   attribution   o que o navegador do cliente registrou (utm_*, dominio de
--                 origem, primeira pagina, data). Cookie proprio da loja; nada
--                 de Google Analytics ou Pixel.
--   lead_id       atendimento (public.leads.id) que nasceu com o pedido do
--                 checkout. Sem FK, como leads.order_id: um pode ser excluido
--                 sem o outro.
--   customer_key  telefone (sem o DDI 55) ou CPF/CNPJ em digitos: reconhece o
--                 cliente que volta. A MESMA regra de src/lib/admin/customers.ts
--                 (customerKey); mudar uma exige mudar a outra.
--   visitor_id    o mesmo cookie domguima_visitante dos cliques de WhatsApp:
--                 liga o pedido as conversas abertas no mesmo navegador.
--
-- POR QUE RECRIAR create_sales_order_v2: o INSERT dela enumera as colunas. Sem
-- recria-la, os campos novos que o app manda no p_order seriam DESCARTADOS EM
-- SILENCIO em producao — e o fallback local em arquivo (que grava o pedido
-- inteiro) faria o teste local passar. O corpo abaixo e o de
-- 202609040002_ledger_cutover.sql (nenhuma migration posterior o recriou) com
-- as seis colunas acrescentadas ao INSERT; on conflict e returning seguem
-- iguais. update_sales_order_status_v2 nao muda.
--
-- PREENCHIMENTO DOS PEDIDOS ANTIGOS (best-effort, so onde channel = ''):
--   * checkout do site (created_by = 'public-site') → channel 'site'. A origem
--     fica '' (nao informada): antes desta migration ninguem a registrou, e
--     chamar de "direto" seria inventar;
--   * lancamento em lote → pelo cabecalho gravado nas notas, com a mesma tabela
--     de src/lib/admin/bulk-orders.ts (mapBulkChannel): marketplace e canal e
--     origem; RETIRADA/ENTREGA → canal 'whatsapp' sem origem; sem cabecalho →
--     canal 'other';
--   * pedidos lancados no painel ficam '' — nao ha como saber o canal deles;
--   * customer_key → telefone ou CPF do proprio pedido.
--
-- O app sobrevive a rodar ANTES desta migration (le as colunas ausentes com o
-- valor padrao e o vinculo lead_id so avisa no console). Mas pedido criado
-- nesse intervalo perde a origem: aplique antes do deploy.
--
-- Idempotente: pode rodar de novo sem efeito (add column if not exists,
-- create index if not exists, updates so onde ainda esta vazio, create or
-- replace).
--
-- Rollback (nesta ordem — a funcao antiga primeiro, porque a desta migration
-- grava nas colunas que o passo 3 apaga):
--   1. Recolar a versao anterior de create_sales_order_v2 (a de
--      202609040002_ledger_cutover.sql, secao 4):
--
--      create or replace function public.create_sales_order_v2(
--        p_order jsonb,
--        p_movements jsonb default '[]'::jsonb,
--        p_audit jsonb default null
--      )
--      returns jsonb
--      language plpgsql
--      security definer
--      set search_path = public
--      as $fn$
--      declare
--        v_request_id text := nullif(p_order->>'request_id', '');
--        v_created_at timestamptz := coalesce(nullif(p_order->>'created_at', '')::timestamptz, now());
--        v_row public.sales_orders;
--        v_number text;
--      begin
--        if v_request_id is not null then
--          select * into v_row from public.sales_orders where request_id = v_request_id;
--          if found then
--            return jsonb_build_object('already_existed', true, 'order', to_jsonb(v_row));
--          end if;
--        end if;
--        v_number := public.next_order_number(v_created_at);
--        insert into public.sales_orders (
--          id, number, request_id, status, seller_id, seller_name, payment_method, delivery_method,
--          customer, items, total_units, gross_total_cents, discount_total_cents, total_cents,
--          commission_total_cents, notes, created_by, created_at, cancelled_at, cancelled_by
--        ) values (
--          coalesce(nullif(p_order->>'id', ''), gen_random_uuid()::text),
--          v_number,
--          v_request_id,
--          coalesce(nullif(p_order->>'status', ''), 'pending'),
--          coalesce(p_order->>'seller_id', ''),
--          coalesce(p_order->>'seller_name', ''),
--          nullif(p_order->>'payment_method', ''),
--          nullif(p_order->>'delivery_method', ''),
--          coalesce(p_order->'customer', '{}'::jsonb),
--          coalesce(p_order->'items', '[]'::jsonb),
--          coalesce(nullif(p_order->>'total_units', '')::integer, 0),
--          coalesce(nullif(p_order->>'gross_total_cents', '')::integer, 0),
--          coalesce(nullif(p_order->>'discount_total_cents', '')::integer, 0),
--          coalesce(nullif(p_order->>'total_cents', '')::integer, 0),
--          coalesce(nullif(p_order->>'commission_total_cents', '')::integer, 0),
--          coalesce(p_order->>'notes', ''),
--          coalesce(p_order->>'created_by', ''),
--          v_created_at,
--          nullif(p_order->>'cancelled_at', '')::timestamptz,
--          nullif(p_order->>'cancelled_by', '')
--        )
--        on conflict (request_id) where request_id is not null do nothing
--        returning * into v_row;
--        if v_row.id is null then
--          select * into v_row from public.sales_orders where request_id = v_request_id;
--          return jsonb_build_object('already_existed', true, 'order', to_jsonb(v_row));
--        end if;
--        perform public.apply_order_stock(p_movements, v_number);
--        if p_audit is not null and jsonb_typeof(p_audit) = 'object' then
--          insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
--          values (
--            coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
--            coalesce(p_audit->>'actor_id', ''),
--            coalesce(p_audit->>'action', ''),
--            coalesce(p_audit->>'entity_type', 'order'),
--            coalesce(nullif(p_audit->>'entity_id', ''), v_row.id),
--            p_audit->'before_data',
--            coalesce(p_audit->'after_data', '{}'::jsonb) || jsonb_build_object('number', v_number),
--            coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
--          )
--          on conflict (id) do nothing;
--        end if;
--        return jsonb_build_object('already_existed', false, 'order', to_jsonb(v_row));
--      end;
--      $fn$;
--
--   2. drop index if exists public.sales_orders_channel_idx;
--      drop index if exists public.sales_orders_source_idx;
--      drop index if exists public.sales_orders_customer_key_idx;
--      drop index if exists public.sales_orders_lead_id_idx;
--
--   3. alter table public.sales_orders
--        drop column if exists channel,
--        drop column if exists source,
--        drop column if exists attribution,
--        drop column if exists lead_id,
--        drop column if exists customer_key,
--        drop column if exists visitor_id;
--
--   O app continua funcionando depois do rollback: le as colunas ausentes com
--   o valor padrao, como antes desta migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------------------------
alter table public.sales_orders
  add column if not exists channel text not null default '',
  add column if not exists source text not null default '',
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists lead_id text,
  add column if not exists customer_key text,
  add column if not exists visitor_id text;

-- ---------------------------------------------------------------------------
-- 2. Indices (relatorio por canal/origem no periodo, cliente recorrente,
--    pedido de um atendimento)
-- ---------------------------------------------------------------------------
create index if not exists sales_orders_channel_idx on public.sales_orders (channel, created_at desc);
create index if not exists sales_orders_source_idx on public.sales_orders (source, created_at desc);
create index if not exists sales_orders_customer_key_idx on public.sales_orders (customer_key) where customer_key is not null;
create index if not exists sales_orders_lead_id_idx on public.sales_orders (lead_id) where lead_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Preenchimento dos pedidos antigos (best-effort; so onde ainda esta vazio)
--
--    As notas do lote comecam com "Lançamento em lote · <CABECALHO>". Os
--    padroes usam .{1,2} no lugar do "ç" e do "·" para casar tanto o texto
--    composto quanto o decomposto (NFC/NFD), e \M (fim de palavra no regex do
--    Postgres) para "SHOPE 28-08" e "SHOPEE 04-09" casarem sem pegar
--    "SHOPEEXYZ". ~* ignora maiusculas, como o leitor do lote.
-- ---------------------------------------------------------------------------
update public.sales_orders
   set channel = 'site'
 where channel = '' and created_by = 'public-site';

update public.sales_orders
   set channel = 'shopee', source = 'shopee'
 where channel = '' and notes ~* '^lan.{1,2}amento em lote .{1,2} shopee?\M';

update public.sales_orders
   set channel = 'mercado_livre', source = 'mercado_livre'
 where channel = '' and notes ~* '^lan.{1,2}amento em lote .{1,2} (mercado ?livre|ml)\M';

update public.sales_orders
   set channel = 'magalu', source = 'magalu'
 where channel = '' and notes ~* '^lan.{1,2}amento em lote .{1,2} (magalu|magazine ?lu.{1,2}za)\M';

-- RETIRADA e ENTREGA: venda combinada no WhatsApp; como o cliente conheceu a
-- loja a mensagem nao diz, entao a origem fica ''.
update public.sales_orders
   set channel = 'whatsapp'
 where channel = '' and notes ~* '^lan.{1,2}amento em lote .{1,2} (retirada|entrega)\M';

-- Bloco sem cabecalho reconhecido ("Sem canal").
update public.sales_orders
   set channel = 'other'
 where channel = '' and notes ~* '^lan.{1,2}amento em lote';

-- Chave do cliente: telefone nacional (10 ou 11 digitos, sem o 55) ou, sem
-- ele, CPF (11) / CNPJ (14). Pedido do lote nao tem nenhum dos dois e fica nulo.
with digitos as (
  select id,
         regexp_replace(coalesce(customer->>'phone', ''), '[^0-9]', '', 'g') as fone,
         regexp_replace(coalesce(customer->>'cpf', ''), '[^0-9]', '', 'g') as doc
    from public.sales_orders
   where customer_key is null
), chaves as (
  select id,
         case when left(fone, 2) = '55' and length(fone) in (12, 13) then substr(fone, 3) else fone end as fone,
         doc
    from digitos
)
update public.sales_orders o
   set customer_key = case when length(c.fone) between 10 and 11 then c.fone else c.doc end
  from chaves c
 where o.id = c.id
   and o.customer_key is null
   and (length(c.fone) between 10 and 11 or length(c.doc) in (11, 14));

-- ---------------------------------------------------------------------------
-- 4. create_sales_order_v2 com as colunas novas no INSERT
--    (corpo de 202609040002; so a lista de colunas e os valores mudaram)
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_order_v2(
  p_order jsonb,
  p_movements jsonb default '[]'::jsonb,
  p_audit jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_request_id text := nullif(p_order->>'request_id', '');
  v_created_at timestamptz := coalesce(nullif(p_order->>'created_at', '')::timestamptz, now());
  v_row public.sales_orders;
  v_number text;
begin
  -- Reenvio do mesmo pedido devolve o que ja existe, sem duplicar nem baixar
  -- estoque de novo.
  if v_request_id is not null then
    select * into v_row from public.sales_orders where request_id = v_request_id;
    if found then
      return jsonb_build_object('already_existed', true, 'order', to_jsonb(v_row));
    end if;
  end if;

  v_number := public.next_order_number(v_created_at);

  insert into public.sales_orders (
    id, number, request_id, status, seller_id, seller_name, payment_method, delivery_method,
    customer, items, total_units, gross_total_cents, discount_total_cents, total_cents,
    commission_total_cents, notes, created_by, created_at, cancelled_at, cancelled_by,
    channel, source, attribution, lead_id, customer_key, visitor_id
  ) values (
    coalesce(nullif(p_order->>'id', ''), gen_random_uuid()::text),
    v_number,
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
    nullif(p_order->>'cancelled_by', ''),
    coalesce(p_order->>'channel', ''),
    coalesce(p_order->>'source', ''),
    -- So objeto: um `null` ou texto no payload vira {} em vez de quebrar o pedido.
    case when jsonb_typeof(p_order->'attribution') = 'object' then p_order->'attribution' else '{}'::jsonb end,
    nullif(p_order->>'lead_id', ''),
    nullif(p_order->>'customer_key', ''),
    nullif(p_order->>'visitor_id', '')
  )
  on conflict (request_id) where request_id is not null do nothing
  returning * into v_row;

  -- Corrida: outra transacao inseriu o mesmo request_id entre o select e o
  -- insert. Devolve o vencedor. O numero gerado acima fica sem uso (a sequencia
  -- do dia pula um), o que e preferivel a criar pedido duplicado.
  if v_row.id is null then
    select * into v_row from public.sales_orders where request_id = v_request_id;
    return jsonb_build_object('already_existed', true, 'order', to_jsonb(v_row));
  end if;

  perform public.apply_order_stock(p_movements, v_number);

  if p_audit is not null and jsonb_typeof(p_audit) = 'object' then
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (
      coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
      coalesce(p_audit->>'actor_id', ''),
      coalesce(p_audit->>'action', ''),
      coalesce(p_audit->>'entity_type', 'order'),
      coalesce(nullif(p_audit->>'entity_id', ''), v_row.id),
      p_audit->'before_data',
      coalesce(p_audit->'after_data', '{}'::jsonb) || jsonb_build_object('number', v_number),
      coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end if;

  return jsonb_build_object('already_existed', false, 'order', to_jsonb(v_row));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Permissoes: so o service_role executa (create or replace preserva as
--    anteriores; repetir aqui deixa a migration correta sozinha)
-- ---------------------------------------------------------------------------
revoke all on function public.create_sales_order_v2(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_sales_order_v2(jsonb, jsonb, jsonb) to service_role;
