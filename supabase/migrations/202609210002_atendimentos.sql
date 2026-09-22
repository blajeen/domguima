-- ============================================================================
-- ATENDIMENTOS (leads): fila livre, distribuicao e transferencia
-- ============================================================================
--
-- Ate aqui, TODO contato que saia do site pelo WhatsApp era invisivel para a
-- loja: o dialogo "Com quem voce quer falar?" abria wa.me direto e o pedido
-- rapido (/checkout/rapido) nao gravava nada. O painel so enxergava o pedido do
-- checkout completo, que nasce sem atendente (seller_id = 'pending'). Nao havia
-- como responder "quem esta com quem", "quantas conversas estao na fila" nem
-- "de onde veio este cliente".
--
-- Esta migration cria `public.leads`: um atendimento por contato que sai do
-- site (ou lancado a mao no painel), com etapa, atendente responsavel e origem.
--
-- Por que TABELA e nao o JSONB de store_settings.__operations: leads crescem
-- sem teto. `replace_catalog_state` reescreve o estado inteiro a cada save, e
-- foi exatamente essa sobrescrita concorrente que fez pedidos sumirem antes do
-- livro-razao (202609040001/0002). Leads seguem o mesmo desenho dos pedidos:
-- tabela propria, escrita so por RPC transacional.
--
-- As duas RPCs ja vem completas, inclusive os modos automaticos de
-- distribuicao, mesmo que o painel comece no modo "cliente escolhe": a escolha
-- do atendente tem de ser atomica, e deixar metade da regra para depois
-- significaria mexer na funcao de novo com leads ja gravados.
--
--   create_lead_v1  — dedupe por visitante (90s) + escolha do atendente sob
--                     pg_advisory_xact_lock. Sem a trava, dois cliques
--                     simultaneos leem o mesmo retrato de "quem recebeu ha mais
--                     tempo" e caem no MESMO atendente, que e justamente o bug
--                     que o rodizio deveria evitar.
--   update_lead_v1  — atribuir, transferir, devolver a fila, trocar etapa e
--                     vincular pedido, com auditoria na mesma transacao.
--
-- `leads.source` e `leads.attribution` ja existem mas por enquanto so recebem o
-- que o cookie domguima_origem trouxer ('direct' e {} quando nao ha nada): a
-- captura de origem (UTM/referrer) e a classificacao entram na feature de
-- controle de trafego, sem nova migration.
--
-- Sem FK para sales_orders em `order_id`: pedido pode ser excluido de vez
-- (bulkOrdersAction) e o atendimento deve sobreviver ao pedido, como o
-- historico de movimento ja faz.
--
-- Rollback:
--   drop function if exists public.create_lead_v1(jsonb, jsonb, text, jsonb);
--   drop function if exists public.update_lead_v1(text, jsonb, jsonb);
--   drop table if exists public.leads;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id text primary key default gen_random_uuid()::text,
  -- whatsapp_generic | whatsapp_product | whatsapp_cart | quick_checkout | site_checkout | manual
  kind text not null,
  -- new | in_progress | quote_sent | awaiting_payment | won | lost
  stage text not null default 'new',
  -- null = fila livre (ninguem pegou ainda)
  seller_id text,
  assigned_at timestamptz,
  -- username do painel | 'customer' (cliente apontou) | 'site' (botao unico)
  -- | 'auto:round_robin' | 'auto:least_busy'
  assigned_by text,
  customer_name text not null default '',
  -- so digitos quando conhecido
  customer_phone text not null default '',
  -- telefone ou CPF em digitos: chave de cliente recorrente
  customer_key text,
  product_id text,
  items jsonb not null default '[]'::jsonb,
  message text not null default '',
  page_path text not null default '',
  source text not null default 'direct',
  attribution jsonb not null default '{}'::jsonb,
  visitor_id text,
  -- sales_orders.id quando o atendimento virou pedido (sem FK de proposito)
  order_id text,
  lost_reason text,
  notes text not null default '',
  closed_at timestamptz,
  created_by text not null default 'public-site',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_seller_stage_idx on public.leads (seller_id, stage, created_at desc);
create index if not exists leads_customer_key_idx on public.leads (customer_key);
create index if not exists leads_order_id_idx on public.leads (order_id);
create index if not exists leads_visitor_idx on public.leads (visitor_id, created_at desc);

alter table public.leads enable row level security;
-- Sem policy: so o service_role (que ignora RLS) enxerga. O app acessa pelo
-- createSupabaseAdminClient().
revoke all on table public.leads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Criar atendimento (dedupe + distribuicao), tudo numa transacao
-- ---------------------------------------------------------------------------
-- p_candidates: [{"id":"juliano"},{"id":"gabriel"}] — quem esta elegivel a
-- receber, ja filtrado pelo app (ativo + "recebe atendimentos" + numero valido).
-- p_mode: manual | customer_choice | round_robin | least_busy.
-- p_audit: opcional. Os cliques do site NAO passam auditoria de proposito —
-- seriam centenas de linhas por dia afogando o historico do painel, que mostra
-- as ultimas 100 acoes. O atendimento lancado a mao passa.
create or replace function public.create_lead_v1(
  p_lead jsonb,
  p_candidates jsonb default '[]'::jsonb,
  p_mode text default 'manual',
  p_audit jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.leads;
  v_visitor text := nullif(p_lead->>'visitor_id', '');
  v_kind text := coalesce(nullif(p_lead->>'kind', ''), 'manual');
  v_product text := coalesce(p_lead->>'product_id', '');
  v_seller text := nullif(p_lead->>'seller_id', '');
  v_assigned_by text := nullif(p_lead->>'assigned_by', '');
  v_mode text := coalesce(nullif(p_mode, ''), 'manual');
begin
  -- Serializa a criacao de atendimentos. A escolha do atendente e um
  -- "le a carga de cada um e grava" — sem trava, duas abas abertas ao mesmo
  -- tempo veem a mesma carga e o rodizio manda as duas para a mesma pessoa.
  -- A trava e da TRANSACAO: solta sozinha no commit/rollback.
  perform pg_advisory_xact_lock(hashtext('leads_assign'));

  -- Dedupe: o mesmo visitante clicando de novo no mesmo botao em menos de 90s
  -- e a mesma conversa (voltou do WhatsApp, recarregou, clicou duas vezes).
  --
  -- O atendente escolhido entra na chave quando existe: quem clica em Juliano,
  -- muda de ideia e clica em Gabriel abriu OUTRA conversa, em outro telefone —
  -- devolver o registro anterior deixaria o painel apontando para quem nao esta
  -- falando com o cliente. Sem escolha (modos automaticos, em que o atendente so
  -- e definido abaixo) a chave continua visitante + tipo + produto.
  if v_visitor is not null then
    select * into v_row
      from public.leads
     where visitor_id = v_visitor
       and kind = v_kind
       and coalesce(product_id, '') = v_product
       and (v_seller is null or coalesce(seller_id, '') = v_seller)
       and created_at > now() - interval '90 seconds'
     order by created_at desc
     limit 1;
    if found then
      return jsonb_build_object('already_existed', true, 'lead', to_jsonb(v_row));
    end if;
  end if;

  -- Distribuicao automatica: so quando ninguem foi escolhido e o modo pede.
  if v_seller is null
     and v_mode in ('round_robin', 'least_busy')
     -- jsonb_array_length levanta excecao se vier um objeto: checar o tipo
     -- antes evita que uma chamada malformada derrube a criacao do atendimento.
     and jsonb_typeof(coalesce(p_candidates, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) > 0 then
    select candidato.id into v_seller
      from (
        select value->>'id' as id
          from jsonb_array_elements(p_candidates)
         where coalesce(value->>'id', '') <> ''
      ) as candidato
      left join lateral (
        select max(l.assigned_at) as ultimo,
               count(*) filter (where l.stage not in ('won', 'lost')) as abertos
          from public.leads l
         where l.seller_id = candidato.id
      ) carga on true
     order by
       -- least_busy: menos conversas abertas primeiro. No rodizio esta chave
       -- fica constante e o desempate abaixo decide sozinho.
       case when v_mode = 'least_busy' then coalesce(carga.abertos, 0) else 0 end,
       -- quem esta ha mais tempo sem receber; nunca recebeu vem primeiro
       carga.ultimo asc nulls first,
       candidato.id
     limit 1;
    if v_seller is not null then
      v_assigned_by := 'auto:' || v_mode;
    end if;
  end if;

  insert into public.leads (
    id, kind, stage, seller_id, assigned_at, assigned_by,
    customer_name, customer_phone, customer_key, product_id, items, message,
    page_path, source, attribution, visitor_id, order_id, lost_reason, notes,
    closed_at, created_by, created_at, updated_at
  ) values (
    coalesce(nullif(p_lead->>'id', ''), gen_random_uuid()::text),
    v_kind,
    coalesce(nullif(p_lead->>'stage', ''), 'new'),
    v_seller,
    case when v_seller is not null then now() else null end,
    case when v_seller is not null then coalesce(v_assigned_by, 'customer') else null end,
    coalesce(p_lead->>'customer_name', ''),
    coalesce(p_lead->>'customer_phone', ''),
    nullif(p_lead->>'customer_key', ''),
    nullif(p_lead->>'product_id', ''),
    coalesce(p_lead->'items', '[]'::jsonb),
    coalesce(p_lead->>'message', ''),
    coalesce(p_lead->>'page_path', ''),
    coalesce(nullif(p_lead->>'source', ''), 'direct'),
    coalesce(p_lead->'attribution', '{}'::jsonb),
    v_visitor,
    nullif(p_lead->>'order_id', ''),
    nullif(p_lead->>'lost_reason', ''),
    coalesce(p_lead->>'notes', ''),
    null,
    coalesce(nullif(p_lead->>'created_by', ''), 'public-site'),
    coalesce(nullif(p_lead->>'created_at', '')::timestamptz, now()),
    now()
  )
  returning * into v_row;

  if p_audit is not null and jsonb_typeof(p_audit) = 'object' then
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (
      coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
      coalesce(p_audit->>'actor_id', ''),
      coalesce(nullif(p_audit->>'action', ''), 'lead.created'),
      coalesce(nullif(p_audit->>'entity_type', ''), 'lead'),
      coalesce(nullif(p_audit->>'entity_id', ''), v_row.id),
      p_audit->'before_data',
      coalesce(p_audit->'after_data', '{}'::jsonb) || jsonb_build_object('seller_id', v_row.seller_id, 'stage', v_row.stage),
      coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end if;

  return jsonb_build_object('already_existed', false, 'lead', to_jsonb(v_row));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Atualizar atendimento (atribuir, transferir, devolver, etapa, pedido)
-- ---------------------------------------------------------------------------
-- O patch e aplicado por PRESENCA DA CHAVE, nao por valor: `seller_id: null`
-- significa "devolver a fila livre" e precisa ser diferente de "nao mexer no
-- atendente". Mesmo padrao de cancelled_at em update_sales_order_status_v2.
create or replace function public.update_lead_v1(
  p_id text,
  p_patch jsonb,
  p_audit jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.leads;
  v_seller text;
  v_assigned_at timestamptz;
  v_assigned_by text;
  v_stage text;
  v_closed_at timestamptz;
begin
  select * into v_row from public.leads where id = p_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  if p_patch ? 'seller_id' then
    v_seller := nullif(p_patch->>'seller_id', '');
    -- Quem acabou de receber vai para o fim do rodizio; devolver a fila limpa
    -- o carimbo para nao contar como "recebeu agora".
    v_assigned_at := case when v_seller is not null then now() else null end;
    v_assigned_by := case when v_seller is not null then nullif(p_patch->>'assigned_by', '') else null end;
  else
    v_seller := v_row.seller_id;
    v_assigned_at := v_row.assigned_at;
    v_assigned_by := v_row.assigned_by;
  end if;

  v_stage := coalesce(nullif(p_patch->>'stage', ''), v_row.stage);
  v_closed_at := case
    when v_stage not in ('won', 'lost') then null
    when v_row.stage = v_stage then coalesce(v_row.closed_at, now())
    else now()
  end;

  update public.leads set
    seller_id = v_seller,
    assigned_at = v_assigned_at,
    assigned_by = v_assigned_by,
    stage = v_stage,
    closed_at = v_closed_at,
    -- Motivo de perda so existe em "perdido": reabrir o atendimento tem de
    -- apagar o motivo antigo, senao o relatorio conta perda que nao houve.
    lost_reason = case
      when v_stage <> 'lost' then null
      when p_patch ? 'lost_reason' then nullif(p_patch->>'lost_reason', '')
      else lost_reason
    end,
    notes = case when p_patch ? 'notes' then coalesce(p_patch->>'notes', '') else notes end,
    order_id = case when p_patch ? 'order_id' then nullif(p_patch->>'order_id', '') else order_id end,
    customer_name = case when p_patch ? 'customer_name' then coalesce(p_patch->>'customer_name', '') else customer_name end,
    customer_phone = case when p_patch ? 'customer_phone' then coalesce(p_patch->>'customer_phone', '') else customer_phone end,
    customer_key = case when p_patch ? 'customer_key' then nullif(p_patch->>'customer_key', '') else customer_key end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if p_audit is not null and jsonb_typeof(p_audit) = 'object' then
    insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
    values (
      coalesce(nullif(p_audit->>'id', ''), gen_random_uuid()::text),
      coalesce(p_audit->>'actor_id', ''),
      coalesce(nullif(p_audit->>'action', ''), 'lead.updated'),
      coalesce(nullif(p_audit->>'entity_type', ''), 'lead'),
      coalesce(nullif(p_audit->>'entity_id', ''), v_row.id),
      p_audit->'before_data',
      coalesce(p_audit->'after_data', '{}'::jsonb) || jsonb_build_object('seller_id', v_row.seller_id, 'stage', v_row.stage),
      coalesce(nullif(p_audit->>'created_at', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end if;

  return jsonb_build_object('found', true, 'lead', to_jsonb(v_row));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Permissoes: so o service_role executa.
-- ---------------------------------------------------------------------------
revoke all on function public.create_lead_v1(jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_lead_v1(jsonb, jsonb, text, jsonb) to service_role;

revoke all on function public.update_lead_v1(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_lead_v1(text, jsonb, jsonb) to service_role;
