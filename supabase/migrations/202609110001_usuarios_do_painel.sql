-- ============================================================================
-- USUARIOS DO PAINEL
-- ============================================================================
--
-- Ate aqui o painel tinha UMA conta so, vinda das variaveis de ambiente
-- (ADMIN_USERNAME / ADMIN_PASSWORD_HASH). Para mais de uma pessoa operar a
-- loja com login proprio — e o historico registrar quem fez o que — as contas
-- passam a viver no banco.
--
-- A conta do ambiente CONTINUA valendo, de proposito. E a rede de seguranca:
-- se esta tabela ficar vazia, for apagada por engano ou o banco cair, o dono
-- ainda entra no painel. Tirar esse caminho seria trocar um risco pequeno
-- (duas formas de autenticar) por um grande (ficar tancado fora do proprio
-- sistema).
--
-- A senha NUNCA e gravada aqui: so o hash scrypt, no mesmo formato que o
-- ambiente ja usa (scrypt$salt$hash). Quem cria a conta e o script
-- `npm run criar:usuario`, que calcula o hash na maquina e manda so ele.
--
-- Rollback:
--   drop table if exists public.admin_users;
-- ============================================================================

create table if not exists public.admin_users (
  -- O proprio nome de usuario digitado no login, sempre minusculo.
  username text primary key,
  name text not null,
  /** scrypt$salt$hash — mesmo formato de ADMIN_PASSWORD_HASH. */
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Sem policy: so o service_role (que ignora RLS) enxerga. O navegador do
-- cliente nunca chega perto desta tabela.
