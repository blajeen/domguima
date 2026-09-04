-- ============================================================================
-- CORRECAO URGENTE — COLUNAS DE COMISSAO EM inventory_movements
-- ============================================================================
--
-- RODE ESTE ARQUIVO ASSIM QUE PUDER: sem ele, salvar produto ou categoria no
-- painel falha com
--   column "commission_percent" of relation "inventory_movements" does not exist
--
-- Por que aconteceu: o `alter table ... add column if not exists` que criava
-- commission_percent e commission_cents estava em 202608250001_catalog.sql mas
-- nunca chegou a rodar neste projeto — a tabela veio de uma versao anterior.
-- A funcao replace_catalog_state reescrita em 202609040002 passou a citar essas
-- colunas, e o app manda os movimentos existentes em todo salvamento.
--
-- A alteracao e aditiva: colunas novas com default 0, nenhum dado e tocado.
-- O historico de comissao ja gravado dentro de audit_logs.after_data continua
-- sendo aproveitado pelo app (enrichMovementCommissions em catalog-store.ts).
-- ============================================================================

alter table public.inventory_movements add column if not exists commission_percent numeric not null default 0;
alter table public.inventory_movements add column if not exists commission_cents integer not null default 0;
