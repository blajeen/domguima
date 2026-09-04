-- ============================================================================
-- FASE 3 — VIRADA: PARAR DE DESTRUIR HISTORICO
-- ============================================================================
--
-- Esta migracao e COMPATIVEL COM A VERSAO DO SITE QUE ESTA NO AR AGORA.
-- Pode ser aplicada antes do deploy do codigo novo, sem quebrar nada.
--
-- O que muda:
--
--   1. replace_catalog_state NAO APAGA MAIS inventory_movements e audit_logs.
--      Era isso que truncava o historico no teto de leitura do app
--      (200 movimentos / 1000 logs) a cada salvamento de produto.
--
--   2. inventory_movements ganha a coluna batch_id. O app ja gravava esse
--      campo, mas a coluna nunca existiu: a protecao contra registrar a mesma
--      baixa de estoque duas vezes (inventory.ts) nunca funcionou no Supabase.
--
--   3. create_sales_order_v2 e update_sales_order_status_v2: pedido, baixa de
--      estoque, movimento e auditoria numa UNICA transacao. Sem elas, um erro
--      no meio deixaria pedido sem baixa ou baixa sem pedido.
--
-- Rollback:
--   - reaplicar replace_catalog_state de 202608250001_catalog.sql;
--   - drop function if exists public.create_sales_order_v2(jsonb, jsonb, jsonb);
--   - drop function if exists public.update_sales_order_status_v2(text, text, jsonb, jsonb, jsonb);
--   - a coluna batch_id pode ficar (e aditiva e ignorada pelo codigo antigo).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. batch_id: idempotencia real das baixas de estoque em lote
-- ---------------------------------------------------------------------------
alter table public.inventory_movements add column if not exists batch_id text;

create index if not exists inventory_movements_batch_idx
  on public.inventory_movements(batch_id) where batch_id is not null;

-- ---------------------------------------------------------------------------
-- 2. append_inventory_movement passa a gravar batch_id
--    (mesma assinatura de 202609040001; so o corpo muda)
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
    commission_percent, commission_cents, actor_id, created_at, batch_id
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
    coalesce(nullif(p_movement->>'created_at', '')::timestamptz, now()),
    nullif(p_movement->>'batch_id', '')
  )
  on conflict (id) do nothing;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Aplicacao de movimentos de estoque, reaproveitada pelas duas funcoes de
--    pedido abaixo. Trava a linha do produto (for update) antes de conferir o
--    saldo: duas vendas simultanea da ultima unidade nao passam as duas.
--
--    p_number substitui o marcador {{number}} na nota, porque o numero do
--    pedido so existe depois que a transacao o gera.
-- ---------------------------------------------------------------------------
create or replace function public.apply_order_stock(p_movements jsonb, p_number text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  mov jsonb;
  v_id text;
  v_delta integer;
  v_before integer;
  v_after integer;
begin
  for mov in select * from jsonb_array_elements(coalesce(p_movements, '[]'::jsonb)) loop
    v_id := mov->>'product_id';
    v_delta := (mov->>'quantity_delta')::integer;

    select stock into v_before from public.products where id = v_id for update;
    if not found then
      raise exception 'PRODUTO_NAO_ENCONTRADO:%', v_id;
    end if;
    if v_before + v_delta < 0 then
      raise exception 'ESTOQUE_INSUFICIENTE:%', v_id;
    end if;

    update public.products
       set stock = v_before + v_delta,
           updated_at = now(),
           last_sale_at = case when v_delta < 0 then now() else last_sale_at end,
           last_stock_entry_at = case when v_delta > 0 then now() else last_stock_entry_at end
     where id = v_id
    returning stock into v_after;

    insert into public.inventory_movements (
      id, product_id, quantity_delta, stock_before, stock_after, reason, note,
      commission_percent, commission_cents, actor_id, created_at, batch_id
    ) values (
      coalesce(nullif(mov->>'id', ''), gen_random_uuid()::text),
      v_id, v_delta, v_before, v_after,
      coalesce(mov->>'reason', ''),
      nullif(replace(coalesce(mov->>'note', ''), '{{number}}', coalesce(p_number, '')), ''),
      coalesce(nullif(mov->>'commission_percent', '')::numeric, 0),
      coalesce(nullif(mov->>'commission_cents', '')::integer, 0),
      coalesce(mov->>'actor_id', ''),
      coalesce(nullif(mov->>'created_at', '')::timestamptz, now()),
      nullif(mov->>'batch_id', '')
    )
    on conflict (id) do nothing;
  end loop;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Pedido + estoque + auditoria numa unica transacao
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
    commission_total_cents, notes, created_by, created_at, cancelled_at, cancelled_by
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
    nullif(p_order->>'cancelled_by', '')
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
-- 5. Confirmar / cancelar: troca de status + estoque + auditoria, atomico.
--    p_expected_status trava a transicao: confirmar duas vezes o mesmo pedido
--    nao baixa o estoque duas vezes.
-- ---------------------------------------------------------------------------
create or replace function public.update_sales_order_status_v2(
  p_id text,
  p_expected_status text,
  p_patch jsonb,
  p_movements jsonb default '[]'::jsonb,
  p_audit jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.sales_orders;
begin
  select * into v_row from public.sales_orders where id = p_id for update;
  if not found then
    return jsonb_build_object('found', false, 'applied', false);
  end if;

  if p_expected_status is not null and v_row.status is distinct from p_expected_status then
    return jsonb_build_object('found', true, 'applied', false, 'order', to_jsonb(v_row));
  end if;

  perform public.apply_order_stock(p_movements, v_row.number);

  update public.sales_orders set
    status       = coalesce(nullif(p_patch->>'status', ''), status),
    seller_id    = coalesce(nullif(p_patch->>'seller_id', ''), seller_id),
    seller_name  = coalesce(nullif(p_patch->>'seller_name', ''), seller_name),
    cancelled_at = case when p_patch ? 'cancelled_at'
                        then nullif(p_patch->>'cancelled_at', '')::timestamptz
                        else cancelled_at end,
    cancelled_by = case when p_patch ? 'cancelled_by'
                        then nullif(p_patch->>'cancelled_by', '')
                        else cancelled_by end
  where id = p_id
  returning * into v_row;

  if p_audit is not null and jsonb_typeof(p_audit) = 'object' then
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (
      coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
      coalesce(p_audit->>'actor_id', ''),
      coalesce(p_audit->>'action', ''),
      coalesce(p_audit->>'entity_type', 'order'),
      coalesce(nullif(p_audit->>'entity_id', ''), v_row.id),
      p_audit->'before_data',
      coalesce(p_audit->'after_data', '{}'::jsonb) || jsonb_build_object('number', v_row.number),
      coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end if;

  return jsonb_build_object('found', true, 'applied', true, 'order', to_jsonb(v_row));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. replace_catalog_state sem os DELETE de inventory_movements e audit_logs
-- ---------------------------------------------------------------------------
create or replace function public.replace_catalog_state(p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product jsonb;
  image jsonb;
  category jsonb;
  movement jsonb;
  audit jsonb;
begin
  -- ATENCAO: inventory_movements e audit_logs NAO sao mais apagados aqui.
  -- Sao livro-razao: so crescem. Apaga-los e reinseri-los a partir do que o
  -- app tinha em memoria destruia todo historico acima do teto de leitura.
  delete from public.product_images where true;
  delete from public.products where true;
  delete from public.categories where true;

  for category in select * from jsonb_array_elements(coalesce(p_state->'categories', '[]'::jsonb)) loop
    insert into public.categories (id, name, slug, description, icon, sort_order, in_main_menu, active)
    values (
      category->>'id', category->>'name', category->>'slug', coalesce(category->>'description', ''), coalesce(category->>'icon', ''),
      coalesce(nullif(category->>'sort_order', '')::integer, 0), coalesce((category->>'in_main_menu')::boolean, true), coalesce((category->>'active')::boolean, true)
    );
  end loop;

  for product in select * from jsonb_array_elements(coalesce(p_state->'products', '[]'::jsonb)) loop
    insert into public.products (
      id, external_id, name, slug, description, price_cents, old_price_cents, category_id, brand, sku, stock, low_stock_threshold, status,
      variants, specifications, shipping, rating, review_count, sold_count, is_featured, is_best_seller, is_offer, is_exclusive, tags,
      data_source, source_url, card_installment, seller_note, published_at, last_stock_entry_at, last_sale_at, hero_enabled, hero_priority, created_at, updated_at
    ) values (
      product->>'id', nullif(product->>'external_id', '')::bigint, product->>'name', product->>'slug', coalesce(product->>'description', ''),
      coalesce(nullif(product->>'price_cents', '')::integer, 0), nullif(product->>'old_price_cents', '')::integer, product->>'category_id',
      nullif(product->>'brand', ''), product->>'sku', coalesce(nullif(product->>'stock', '')::integer, 0), coalesce(nullif(product->>'low_stock_threshold', '')::integer, 3),
      coalesce(product->>'status', 'draft'), coalesce(product->'variants', '[]'::jsonb), coalesce(product->'specifications', '[]'::jsonb), coalesce(product->'shipping', '{}'::jsonb),
      nullif(product->>'rating', '')::numeric, nullif(product->>'review_count', '')::integer, nullif(product->>'sold_count', '')::integer,
      coalesce((product->>'is_featured')::boolean, false), coalesce((product->>'is_best_seller')::boolean, false), coalesce((product->>'is_offer')::boolean, false), coalesce((product->>'is_exclusive')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(product->'tags')), '{}'::text[]), nullif(product->>'data_source', ''), nullif(product->>'source_url', ''),
      nullif(product->'card_installment', 'null'::jsonb), nullif(product->>'seller_note', ''), nullif(product->>'published_at', '')::timestamptz,
      nullif(product->>'last_stock_entry_at', '')::timestamptz, nullif(product->>'last_sale_at', '')::timestamptz, coalesce((product->>'hero_enabled')::boolean, true),
      coalesce(nullif(product->>'hero_priority', '')::integer, 0), coalesce(nullif(product->>'created_at', '')::timestamptz, now()), coalesce(nullif(product->>'updated_at', '')::timestamptz, now())
    );

    for image in select * from jsonb_array_elements(coalesce(product->'product_images', '[]'::jsonb)) loop
      insert into public.product_images (id, product_id, src, storage_path, alt, sort_order, is_primary)
      values (image->>'id', product->>'id', image->>'src', nullif(image->>'storage_path', ''), coalesce(image->>'alt', ''), coalesce(nullif(image->>'sort_order', '')::integer, 0), coalesce((image->>'is_primary')::boolean, false));
    end loop;
  end loop;

  -- Movimentos e auditoria continuam vindo junto do estado (contagem de
  -- estoque e edicoes do catalogo os produzem). "on conflict do nothing"
  -- torna a operacao aditiva: nada e sobrescrito e nada e perdido.
  for movement in select * from jsonb_array_elements(coalesce(p_state->'inventoryMovements', '[]'::jsonb)) loop
    insert into public.inventory_movements (id, product_id, quantity_delta, stock_before, stock_after, reason, note, commission_percent, commission_cents, actor_id, created_at, batch_id)
    values (movement->>'id', movement->>'product_id', (movement->>'quantity_delta')::integer, (movement->>'stock_before')::integer, (movement->>'stock_after')::integer, movement->>'reason', nullif(movement->>'note', ''), coalesce(nullif(movement->>'commission_percent', '')::numeric, 0), coalesce(nullif(movement->>'commission_cents', '')::integer, 0), movement->>'actor_id', coalesce(nullif(movement->>'created_at', '')::timestamptz, now()), nullif(movement->>'batch_id', ''))
    on conflict (id) do nothing;
  end loop;

  for audit in select * from jsonb_array_elements(coalesce(p_state->'auditLogs', '[]'::jsonb)) loop
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (audit->>'id', audit->>'actor_id', audit->>'action', audit->>'entity_type', audit->>'entity_id', audit->'before_data', audit->'after_data', coalesce(nullif(audit->>'created_at', '')::timestamptz, now()))
    on conflict (id) do nothing;
  end loop;

  insert into public.store_settings (id, catalog_enabled, settings, updated_at)
  values ('store', coalesce((p_state->>'catalogEnabled')::boolean, false), coalesce(p_state->'settings', '{}'::jsonb), coalesce(nullif(p_state->>'updatedAt', '')::timestamptz, now()))
  on conflict (id) do update set catalog_enabled = excluded.catalog_enabled, settings = excluded.settings, updated_at = excluded.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissoes: so o service_role executa
-- ---------------------------------------------------------------------------
revoke all on function public.apply_order_stock(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_sales_order_v2(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.update_sales_order_status_v2(text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.append_inventory_movement(jsonb) from public, anon, authenticated;
revoke all on function public.replace_catalog_state(jsonb) from public, anon, authenticated;

grant execute on function public.apply_order_stock(jsonb, text) to service_role;
grant execute on function public.create_sales_order_v2(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.update_sales_order_status_v2(text, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.append_inventory_movement(jsonb) to service_role;
grant execute on function public.replace_catalog_state(jsonb) to service_role;
