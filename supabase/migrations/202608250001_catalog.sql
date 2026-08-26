
-- Persistencia do painel E-Commerce no projeto Supabase Dom Guima.
-- O painel acessa estas estruturas somente pelo servidor com a chave secreta.

create table if not exists public.store_settings (
  id text primary key,
  catalog_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default '',
  icon text not null default '',
  sort_order integer not null default 0,
  in_main_menu boolean not null default true,
  active boolean not null default true
);

create table if not exists public.products (
  id text primary key,
  external_id bigint,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_cents integer not null default 0,
  old_price_cents integer,
  category_id text not null,
  brand text,
  sku text not null unique,
  stock integer not null default 0,
  low_stock_threshold integer not null default 3,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  variants jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '[]'::jsonb,
  shipping jsonb not null default '{}'::jsonb,
  rating numeric,
  review_count integer,
  sold_count integer,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_offer boolean not null default false,
  is_exclusive boolean not null default false,
  tags text[] not null default '{}'::text[],
  data_source text not null default 'loja-verified',
  source_url text,
  card_installment jsonb,
  seller_note text,
  published_at timestamptz,
  last_stock_entry_at timestamptz,
  last_sale_at timestamptz,
  hero_enabled boolean not null default true,
  hero_priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_category_id_fkey foreign key (category_id) references public.categories(id) on update cascade on delete restrict
);

create table if not exists public.product_images (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  src text not null,
  storage_path text,
  alt text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false
);

create table if not exists public.inventory_movements (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  quantity_delta integer not null,
  stock_before integer not null,
  stock_after integer not null,
  reason text not null,
  note text,
  actor_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_status_updated_at_idx on public.products(status, updated_at desc);
create index if not exists product_images_product_id_idx on public.product_images(product_id, sort_order);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.store_settings, public.categories, public.products, public.product_images, public.inventory_movements, public.audit_logs from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ecommerce-products', 'ecommerce-products', true, 4194304, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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
  delete from public.audit_logs where true;
  delete from public.inventory_movements where true;
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

  for movement in select * from jsonb_array_elements(coalesce(p_state->'inventoryMovements', '[]'::jsonb)) loop
    insert into public.inventory_movements (id, product_id, quantity_delta, stock_before, stock_after, reason, note, actor_id, created_at)
    values (movement->>'id', movement->>'product_id', (movement->>'quantity_delta')::integer, (movement->>'stock_before')::integer, (movement->>'stock_after')::integer, movement->>'reason', nullif(movement->>'note', ''), movement->>'actor_id', coalesce(nullif(movement->>'created_at', '')::timestamptz, now()));
  end loop;

  for audit in select * from jsonb_array_elements(coalesce(p_state->'auditLogs', '[]'::jsonb)) loop
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (audit->>'id', audit->>'actor_id', audit->>'action', audit->>'entity_type', audit->>'entity_id', audit->'before_data', audit->'after_data', coalesce(nullif(audit->>'created_at', '')::timestamptz, now()));
  end loop;

  insert into public.store_settings (id, catalog_enabled, settings, updated_at)
  values ('store', coalesce((p_state->>'catalogEnabled')::boolean, false), coalesce(p_state->'settings', '{}'::jsonb), coalesce(nullif(p_state->>'updatedAt', '')::timestamptz, now()))
  on conflict (id) do update set catalog_enabled = excluded.catalog_enabled, settings = excluded.settings, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.replace_catalog_state(jsonb) from public, anon, authenticated;
grant execute on function public.replace_catalog_state(jsonb) to service_role;
