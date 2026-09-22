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
-- inventory_movements.note antigas continuam dizendo "Dom Guima": e texto
-- historico, nao e agrupado em lugar nenhum, e reescrever nota de movimento
-- e mexer em livro-razao.
--
-- Rollback:
--   update public.sales_orders set seller_id = 'dom-guima', seller_name = 'Dom Guima'
--     where seller_id = 'juliano';
--   update public.store_settings
--     set settings = jsonb_set(settings, '{__operations,sellers}', (
--       select jsonb_agg(case when s->>'id' = 'juliano' then s || '{"id":"dom-guima","name":"Dom Guima"}'::jsonb else s end)
--       from jsonb_array_elements(settings->'__operations'->'sellers') s))
--     where id = 'store' and settings->'__operations'->'sellers' @> '[{"id":"juliano"}]'::jsonb;
--   alter table public.admin_users drop column if exists seller_id;
-- ============================================================================

-- 1. Vinculo login → atendente.
alter table public.admin_users add column if not exists seller_id text;

-- 2. Id canonico do dono nos pedidos ja gravados.
update public.sales_orders
   set seller_id = 'juliano', seller_name = 'Juliano'
 where seller_id = 'dom-guima';

-- 3. Mesmo ajuste no JSONB de atendentes, quando ele ainda tem o id antigo.
--    O app tambem faz esse mapeamento ao ler (normalizeSeller), entao rodar
--    esta parte antes ou depois do deploy da o mesmo resultado.
update public.store_settings
   set settings = jsonb_set(
     settings,
     '{__operations,sellers}',
     (
       select jsonb_agg(
         case when s->>'id' = 'dom-guima'
              then s || '{"id":"juliano","name":"Juliano"}'::jsonb
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
