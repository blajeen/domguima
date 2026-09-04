-- ============================================================================
-- FASE 1 — INSPECAO SOMENTE LEITURA
-- Cole no SQL Editor da Supabase e clique em Run.
-- Nao cria, nao altera e nao apaga nada. So conta e mostra.
-- ============================================================================

with ops as (
  select coalesce(settings->'__operations', '{}'::jsonb) as o
  from public.store_settings
  where id = 'store'
),
lista as (
  select case
    when jsonb_typeof(o->'orders') = 'array' then o->'orders'
    else '[]'::jsonb
  end as arr
  from ops
),
pedidos as (
  select jsonb_array_elements(arr) as p from lista
)
select 'pedidos no JSONB' as item,
       coalesce((select count(*) from pedidos), 0)::text as valor
union all
select 'numeros de pedido repetidos',
       coalesce((select count(*) from (
         select 1 from pedidos group by p->>'number' having count(*) > 1
       ) x), 0)::text
union all
select 'pedidos sem request_id',
       coalesce((select count(*) from pedidos where nullif(p->>'request_id','') is null), 0)::text
union all
select 'movimentos de estoque (total)',
       (select count(*) from public.inventory_movements)::text
union all
select 'movimentos acima do teto de 200',
       (select greatest(count(*) - 200, 0) from public.inventory_movements)::text
union all
select 'logs de auditoria (total)',
       (select count(*) from public.audit_logs)::text
union all
select 'logs acima do teto de 1000',
       (select greatest(count(*) - 1000, 0) from public.audit_logs)::text
union all
select 'produtos',
       (select count(*) from public.products)::text
union all
select 'categorias',
       (select count(*) from public.categories)::text
union all
select 'imagens de produto',
       (select count(*) from public.product_images)::text
union all
select 'tabela sales_orders ja existe?',
       case when to_regclass('public.sales_orders') is null
            then 'nao (esperado)' else 'SIM - revisar antes de migrar' end;
