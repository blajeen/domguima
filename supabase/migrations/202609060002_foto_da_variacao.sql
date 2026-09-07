-- ============================================================================
-- FOTO POR VARIACAO
-- ============================================================================
--
-- "pra quando a pessoa clicar aparecer o preto e preto, cinza e cinza."
--
-- Guarda a URL da foto, e nao o id da linha em product_images, de proposito:
-- replace_catalog_state apaga e reinsere a tabela de imagens inteira a cada
-- salvamento. Uma chave estrangeira para la seria violada nesse intervalo, ou
-- zerada a cada save se fosse ON DELETE SET NULL — a foto da cor se perderia
-- sozinha toda vez que o lojista mexesse em qualquer produto.
--
-- Sem foto marcada, ou com a foto removida do produto depois, a vitrine cai na
-- imagem principal. Nao ha estado quebrado a limpar.
--
-- Rollback:
--   alter table public.product_variants drop column if exists image_src;
--   e reaplicar replace_catalog_state de 202609060001_variacoes.sql.
-- ============================================================================

alter table public.product_variants add column if not exists image_src text;

-- ---------------------------------------------------------------------------
-- replace_catalog_state passa a gravar image_src junto com a variacao.
-- Unica diferenca em relacao a 202609060001; o resto do corpo e identico.
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

  if jsonb_array_length(v_products) > 0 then
    delete from public.products p
     where not exists (select 1 from jsonb_array_elements(v_products) x where x->>'id' = p.id);
  end if;

  if jsonb_array_length(v_categories) > 0 then
    delete from public.categories c
     where not exists (select 1 from jsonb_array_elements(v_categories) x where x->>'id' = c.id);
  end if;

  for product in select * from jsonb_array_elements(v_products) loop
    for variante in select * from jsonb_array_elements(coalesce(product->'product_variants', '[]'::jsonb)) loop
      insert into public.product_variants (id, product_id, label, sku, price_cents, stock, sort_order, active, image_src, updated_at)
      values (
        variante->>'id', product->>'id', variante->>'label', variante->>'sku',
        coalesce(nullif(variante->>'price_cents', '')::integer, 0),
        coalesce(nullif(variante->>'stock', '')::integer, 0),
        coalesce(nullif(variante->>'sort_order', '')::integer, 0),
        coalesce((variante->>'active')::boolean, true),
        nullif(variante->>'image_src', ''),
        now()
      )
      on conflict (id) do update set
        label = excluded.label, sku = excluded.sku, price_cents = excluded.price_cents,
        stock = excluded.stock, sort_order = excluded.sort_order, active = excluded.active,
        image_src = excluded.image_src, updated_at = now();
    end loop;

    delete from public.product_variants v
     where v.product_id = product->>'id'
       and not exists (
         select 1 from jsonb_array_elements(coalesce(product->'product_variants', '[]'::jsonb)) x
          where x->>'id' = v.id
       );

    perform public.sync_product_stock(product->>'id');
  end loop;

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

revoke all on function public.replace_catalog_state(jsonb) from public, anon, authenticated;
grant execute on function public.replace_catalog_state(jsonb) to service_role;
