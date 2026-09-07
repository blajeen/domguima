-- ============================================================================
-- VARIACOES DE PRODUTO (cor, voltagem, tamanho)
-- ============================================================================
--
-- Hoje "variants" e so um rotulo no produto: {name:"Voltagem", options:[...]}.
-- Nao ha preco, estoque nem SKU por opcao, e por isso a loja acabou com tres
-- produtos separados para as tres cores do mesmo suporte (DG-ELT-002, -043,
-- -044). Esta migracao cria a variacao de verdade.
--
-- Decisoes que valem registrar:
--
--   * products.stock passa a ser a SOMA dos estoques das variacoes ativas,
--     mantida pelo proprio banco. Assim toda leitura que ja existe — lista do
--     painel, vitrine, relatorio, alerta de estoque baixo — continua correta
--     sem precisar saber o que e variacao.
--
--   * inventory_movements.variant_id usa ON DELETE SET NULL, nao CASCADE.
--     Apagar uma cor descontinuada nao pode apagar o historico de venda dela.
--
--   * Produto sem variacao continua funcionando exatamente como antes: o
--     caminho antigo de apply_order_stock nao muda.
--
-- Rollback:
--   alter table public.inventory_movements drop column if exists variant_id;
--   alter table public.products drop column if exists variant_axis;
--   drop table if exists public.product_variants;
--   e reaplicar apply_order_stock e replace_catalog_state de
--   202609040005_guarda_imagens.sql / 202609040002_ledger_cutover.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  -- Rotulo da opcao: "Preto", "220V", "GG".
  label text not null,
  sku text not null,
  price_cents integer not null default 0,
  stock integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_variants_sku_key on public.product_variants(sku);
create index if not exists product_variants_product_idx on public.product_variants(product_id, sort_order);

-- Nome do eixo escolhido pelo lojista: "Cor", "Voltagem", "Tamanho".
alter table public.products add column if not exists variant_axis text;

-- SET NULL de proposito: remover uma cor nao pode levar junto o historico de
-- venda dela. O movimento continua no livro-razao, apontando so para o produto.
alter table public.inventory_movements
  add column if not exists variant_id text references public.product_variants(id) on delete set null;

create index if not exists inventory_movements_variant_idx
  on public.inventory_movements(variant_id) where variant_id is not null;

alter table public.product_variants enable row level security;

-- ---------------------------------------------------------------------------
-- 2. products.stock = soma das variacoes ativas
-- ---------------------------------------------------------------------------
create or replace function public.sync_product_stock(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.products p
     set stock = coalesce((
           select sum(v.stock) from public.product_variants v
            where v.product_id = p.id and v.active
         ), 0),
         updated_at = now()
   where p.id = p_product_id
     and exists (select 1 from public.product_variants v where v.product_id = p.id);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. apply_order_stock com variacao
--    Produto sem variacao segue pelo caminho antigo, sem mudanca nenhuma.
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
  v_variant text;
  v_delta integer;
  v_before integer;
  v_after integer;
begin
  for mov in select * from jsonb_array_elements(coalesce(p_movements, '[]'::jsonb)) loop
    v_id := mov->>'product_id';
    v_variant := nullif(mov->>'variant_id', '');
    v_delta := (mov->>'quantity_delta')::integer;

    if v_variant is not null then
      -- Trava a linha da VARIACAO: duas vendas simultaneas da ultima unidade
      -- preta nao passam as duas, e a branca nem entra na disputa.
      select stock into v_before from public.product_variants
       where id = v_variant and product_id = v_id for update;
      if not found then
        raise exception 'VARIACAO_NAO_ENCONTRADA:%', v_variant;
      end if;
      if v_before + v_delta < 0 then
        raise exception 'ESTOQUE_INSUFICIENTE:%', v_id;
      end if;

      update public.product_variants
         set stock = v_before + v_delta, updated_at = now()
       where id = v_variant
      returning stock into v_after;

      perform public.sync_product_stock(v_id);
    else
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
    end if;

    insert into public.inventory_movements (
      id, product_id, variant_id, quantity_delta, stock_before, stock_after, reason, note,
      commission_percent, commission_cents, actor_id, created_at, batch_id
    ) values (
      coalesce(nullif(mov->>'id', ''), gen_random_uuid()::text),
      v_id, v_variant, v_delta, v_before, v_after,
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
-- 4. replace_catalog_state grava as variacoes junto com o produto
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
  variante jsonb;
  category jsonb;
  movement jsonb;
  audit jsonb;
  v_products jsonb := coalesce(p_state->'products', '[]'::jsonb);
  v_categories jsonb := coalesce(p_state->'categories', '[]'::jsonb);
begin
  -- 1. Categorias primeiro: os produtos referenciam category_id.
  for category in select * from jsonb_array_elements(v_categories) loop
    insert into public.categories (id, name, slug, description, icon, sort_order, in_main_menu, active)
    values (
      category->>'id', category->>'name', category->>'slug', coalesce(category->>'description', ''), coalesce(category->>'icon', ''),
      coalesce(nullif(category->>'sort_order', '')::integer, 0), coalesce((category->>'in_main_menu')::boolean, true), coalesce((category->>'active')::boolean, true)
    )
    on conflict (id) do update set
      name = excluded.name, slug = excluded.slug, description = excluded.description, icon = excluded.icon,
      sort_order = excluded.sort_order, in_main_menu = excluded.in_main_menu, active = excluded.active;
  end loop;

  -- 2. Produtos por upsert. Nenhuma linha e apagada, entao o cascade que
  --    destruia inventory_movements nunca dispara para produto que ficou.
  for product in select * from jsonb_array_elements(v_products) loop
    insert into public.products (
      id, external_id, name, slug, description, price_cents, old_price_cents, category_id, brand, sku, stock, low_stock_threshold, status,
      variants, variant_axis, specifications, shipping, rating, review_count, sold_count, is_featured, is_best_seller, is_offer, is_exclusive, tags,
      data_source, source_url, card_installment, seller_note, published_at, last_stock_entry_at, last_sale_at, hero_enabled, hero_priority, created_at, updated_at
    ) values (
      product->>'id', nullif(product->>'external_id', '')::bigint, product->>'name', product->>'slug', coalesce(product->>'description', ''),
      coalesce(nullif(product->>'price_cents', '')::integer, 0), nullif(product->>'old_price_cents', '')::integer, product->>'category_id',
      nullif(product->>'brand', ''), product->>'sku', coalesce(nullif(product->>'stock', '')::integer, 0), coalesce(nullif(product->>'low_stock_threshold', '')::integer, 3),
      coalesce(product->>'status', 'draft'), coalesce(product->'variants', '[]'::jsonb), nullif(product->>'variant_axis', ''),
      coalesce(product->'specifications', '[]'::jsonb), coalesce(product->'shipping', '{}'::jsonb),
      nullif(product->>'rating', '')::numeric, nullif(product->>'review_count', '')::integer, nullif(product->>'sold_count', '')::integer,
      coalesce((product->>'is_featured')::boolean, false), coalesce((product->>'is_best_seller')::boolean, false), coalesce((product->>'is_offer')::boolean, false), coalesce((product->>'is_exclusive')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(product->'tags')), '{}'::text[]), nullif(product->>'data_source', ''), nullif(product->>'source_url', ''),
      nullif(product->'card_installment', 'null'::jsonb), nullif(product->>'seller_note', ''), nullif(product->>'published_at', '')::timestamptz,
      nullif(product->>'last_stock_entry_at', '')::timestamptz, nullif(product->>'last_sale_at', '')::timestamptz, coalesce((product->>'hero_enabled')::boolean, true),
      coalesce(nullif(product->>'hero_priority', '')::integer, 0), coalesce(nullif(product->>'created_at', '')::timestamptz, now()), coalesce(nullif(product->>'updated_at', '')::timestamptz, now())
    )
    on conflict (id) do update set
      external_id = excluded.external_id, name = excluded.name, slug = excluded.slug, description = excluded.description,
      price_cents = excluded.price_cents, old_price_cents = excluded.old_price_cents, category_id = excluded.category_id,
      brand = excluded.brand, sku = excluded.sku, stock = excluded.stock, low_stock_threshold = excluded.low_stock_threshold,
      status = excluded.status, variants = excluded.variants, variant_axis = excluded.variant_axis,
      specifications = excluded.specifications, shipping = excluded.shipping,
      rating = excluded.rating, review_count = excluded.review_count, sold_count = excluded.sold_count,
      is_featured = excluded.is_featured, is_best_seller = excluded.is_best_seller, is_offer = excluded.is_offer,
      is_exclusive = excluded.is_exclusive, tags = excluded.tags, data_source = excluded.data_source, source_url = excluded.source_url,
      card_installment = excluded.card_installment, seller_note = excluded.seller_note, published_at = excluded.published_at,
      last_stock_entry_at = excluded.last_stock_entry_at, last_sale_at = excluded.last_sale_at,
      hero_enabled = excluded.hero_enabled, hero_priority = excluded.hero_priority,
      created_at = excluded.created_at, updated_at = excluded.updated_at;
  end loop;

  -- 3. Remove so o que saiu do catalogo. Payload vazio nao apaga nada.
  if jsonb_array_length(v_products) > 0 then
    delete from public.products p
     where not exists (select 1 from jsonb_array_elements(v_products) x where x->>'id' = p.id);
  end if;

  if jsonb_array_length(v_categories) > 0 then
    delete from public.categories c
     where not exists (select 1 from jsonb_array_elements(v_categories) x where x->>'id' = c.id);
  end if;

  -- 4. Variacoes: upsert e remocao apenas do que saiu da ficha do produto.
  --    Feito por produto para nao encostar em quem nao veio no payload.
  for product in select * from jsonb_array_elements(v_products) loop
    for variante in select * from jsonb_array_elements(coalesce(product->'product_variants', '[]'::jsonb)) loop
      insert into public.product_variants (id, product_id, label, sku, price_cents, stock, sort_order, active, updated_at)
      values (
        variante->>'id', product->>'id', variante->>'label', variante->>'sku',
        coalesce(nullif(variante->>'price_cents', '')::integer, 0),
        coalesce(nullif(variante->>'stock', '')::integer, 0),
        coalesce(nullif(variante->>'sort_order', '')::integer, 0),
        coalesce((variante->>'active')::boolean, true),
        now()
      )
      on conflict (id) do update set
        label = excluded.label, sku = excluded.sku, price_cents = excluded.price_cents,
        stock = excluded.stock, sort_order = excluded.sort_order, active = excluded.active, updated_at = now();
    end loop;

    delete from public.product_variants v
     where v.product_id = product->>'id'
       and not exists (
         select 1 from jsonb_array_elements(coalesce(product->'product_variants', '[]'::jsonb)) x
          where x->>'id' = v.id
       );

    perform public.sync_product_stock(product->>'id');
  end loop;

  -- 5. Imagens sob a mesma guarda do passo 3.
  if jsonb_array_length(v_products) > 0 then
    delete from public.product_images where true;
    for product in select * from jsonb_array_elements(v_products) loop
      for image in select * from jsonb_array_elements(coalesce(product->'product_images', '[]'::jsonb)) loop
        insert into public.product_images (id, product_id, src, storage_path, alt, sort_order, is_primary)
        values (image->>'id', product->>'id', image->>'src', nullif(image->>'storage_path', ''), coalesce(image->>'alt', ''), coalesce(nullif(image->>'sort_order', '')::integer, 0), coalesce((image->>'is_primary')::boolean, false))
        on conflict (id) do nothing;
      end loop;
    end loop;
  end if;

  -- 6. Livro-razao: so cresce. Nunca apagado, nunca sobrescrito.
  for movement in select * from jsonb_array_elements(coalesce(p_state->'inventoryMovements', '[]'::jsonb)) loop
    insert into public.inventory_movements (id, product_id, variant_id, quantity_delta, stock_before, stock_after, reason, note, commission_percent, commission_cents, actor_id, created_at, batch_id)
    values (movement->>'id', movement->>'product_id', nullif(movement->>'variant_id', ''), (movement->>'quantity_delta')::integer, (movement->>'stock_before')::integer, (movement->>'stock_after')::integer, movement->>'reason', nullif(movement->>'note', ''), coalesce(nullif(movement->>'commission_percent', '')::numeric, 0), coalesce(nullif(movement->>'commission_cents', '')::integer, 0), movement->>'actor_id', coalesce(nullif(movement->>'created_at', '')::timestamptz, now()), nullif(movement->>'batch_id', ''))
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
revoke all on function public.sync_product_stock(text) from public, anon, authenticated;
revoke all on function public.apply_order_stock(jsonb, text) from public, anon, authenticated;
revoke all on function public.replace_catalog_state(jsonb) from public, anon, authenticated;

grant execute on function public.sync_product_stock(text) to service_role;
grant execute on function public.apply_order_stock(jsonb, text) to service_role;
grant execute on function public.replace_catalog_state(jsonb) to service_role;
