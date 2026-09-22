-- ============================================================================
-- ATENDENTES UNIFICADOS (vendedor = atendente = login)
-- ============================================================================
--
-- Ate aqui existiam TRES listas de "quem atende", cada uma com o seu id:
--
--   1. whatsappContacts em src/config/site.ts  → ids "juliano" e "gabriel"
--      (e o que o cliente ve no dialogo "Com quem voce quer falar?");
--   2. store_settings.settings.__operations.sellers (JSONB)
--      → ids "dom-guima" e "gabriel" (e o vendedor gravado no pedido);
--   3. public.admin_users (login do painel) → sem nenhum vinculo com as duas.
--
-- Resultado: o mesmo dono era "Juliano" no site e "Dom Guima" no painel, e o
-- painel nao sabia qual atendente estava logado. A partir desta migration:
--
--   * a lista de atendentes continua no JSONB __operations.sellers (agora com
--     funcao, WhatsApp proprio, "recebe atendimentos", ordem), editada pelo
--     painel em Configuracoes → Atendentes. Nao ganha tabela: sao 2 pessoas e
--     replace_catalog_state ja persiste esse bloco;
--   * o id canonico do dono passa a ser "juliano" (o mesmo do site). Os pedidos
--     gravados com "dom-guima" sao renomeados aqui para os relatorios agruparem
--     tudo numa linha so. E um UPDATE em texto, sem FK, reversivel (abaixo);
--   * admin_users ganha seller_id: qual atendente aquele login representa. O
--     JWT carrega esse valor e o painel pode pre-selecionar "eu" nas telas.
--     Sem FK porque os atendentes moram no JSONB. Preenchido pela CLI
--     (npm run criar:usuario -- <user> --vendedor <seller_id>).
--
-- O app faz o MESMO mapeamento ao ler (canonicalSellerId/normalizeSeller/
-- canonicalizeOrderSellers em src/lib/admin/sellers.ts), entao rodar este SQL
-- antes ou depois do deploy da o mesmo resultado. Onde o app preserva um nome
-- customizado, o SQL preserva tambem: as duas metades da regra tem de bater.
--
-- inventory_movements.note antigas continuam dizendo "Dom Guima": e texto
-- historico, nao e agrupado em lugar nenhum, e reescrever nota de movimento
-- e mexer em livro-razao.
--
-- Rollback (nesta ordem; a tabela de backup guarda so as linhas que o passo 2
-- tocou, por isso pedidos criados DEPOIS da migration ficam intactos):
--   update public.sales_orders o
--      set seller_id = b.seller_id, seller_name = b.seller_name
--     from public.sales_orders_backup_202609210001 b
--    where b.id = o.id;
--   drop table if exists public.sales_orders_backup_202609210001;
--   update public.store_settings
--     set settings = jsonb_set(settings, '{__operations,sellers}', (
--       select jsonb_agg(
--         case when s->>'id' = 'juliano'
--              then jsonb_set(s, '{id}', '"dom-guima"')
--                   || (case when coalesce(s->>'name', '') in ('', 'Juliano')
--                            then '{"name":"Dom Guima"}'::jsonb else '{}'::jsonb end)
--              else s
--         end)
--       from jsonb_array_elements(settings->'__operations'->'sellers') s))
--     where id = 'store' and settings->'__operations'->'sellers' @> '[{"id":"juliano"}]'::jsonb;
--   alter table public.admin_users drop column if exists seller_id;
-- ============================================================================

-- 1. Vinculo login → atendente.
alter table public.admin_users add column if not exists seller_id text;

-- 2. Id canonico do dono nos pedidos ja gravados.
--    O backup guarda EXATAMENTE as linhas tocadas. Sem ele o rollback teria de
--    reverter todo "juliano" e levaria junto os pedidos criados depois desta
--    migration, que nunca foram "dom-guima" — estrago sem volta, porque o
--    seller_name original de cada um ja teria se perdido.
create table if not exists public.sales_orders_backup_202609210001 as
  select id, seller_id, seller_name from public.sales_orders where seller_id = 'dom-guima';
alter table public.sales_orders_backup_202609210001 enable row level security;
revoke all on table public.sales_orders_backup_202609210001 from anon, authenticated;

--    O nome so e trocado quando ainda e o rotulo antigo: se alguem renomeou o
--    atendente no painel, o pedido mantem o nome escolhido (mesma regra de
--    canonicalizeOrderSellers).
update public.sales_orders
   set seller_id = 'juliano',
       seller_name = case when coalesce(seller_name, '') in ('', 'Dom Guima') then 'Juliano' else seller_name end
 where seller_id = 'dom-guima';

-- 3. Mesmo ajuste no JSONB de atendentes, quando ele ainda tem o id antigo.
--    `jsonb_set` so no id: um nome digitado no painel ("Juliano Guimaraes")
--    nao pode ser descartado por causa da ordem em que o SQL foi colado.
update public.store_settings
   set settings = jsonb_set(
     settings,
     '{__operations,sellers}',
     (
       select jsonb_agg(
         case when s->>'id' = 'dom-guima'
              then jsonb_set(s, '{id}', '"juliano"')
                   || (case when coalesce(s->>'name', '') in ('', 'Dom Guima')
                            then '{"name":"Juliano"}'::jsonb else '{}'::jsonb end)
              else s
         end
       )
       from jsonb_array_elements(settings->'__operations'->'sellers') s
     )
   )
 where id = 'store'
   and settings->'__operations'->'sellers' @> '[{"id":"dom-guima"}]'::jsonb;

-- 4. Vinculos obvios, best effort: so preenche quem ainda nao tem. Outros
--    logins recebem o vinculo pela CLI (--vendedor).
update public.admin_users set seller_id = 'gabriel' where username = 'gabriel' and seller_id is null;
update public.admin_users set seller_id = 'juliano' where username = 'juliano' and seller_id is null;
