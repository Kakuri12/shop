create extension if not exists pgcrypto;

create table if not exists public.script_licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  discord_id text not null,
  product_id text not null default 'shora-hub-v1',
  status text not null default 'active' check (status in ('active', 'revoked')),
  max_devices integer not null default 1 check (max_devices >= 1),
  hwid_hash text,
  hwid_bound_at timestamptz,
  expires_at timestamptz,
  note text not null default '',
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.script_auth_logs (
  id uuid primary key default gen_random_uuid(),
  license_key text,
  discord_id text,
  hwid_hash text,
  allowed boolean not null default false,
  reason text not null default '',
  ip_text text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists script_licenses_discord_id_idx on public.script_licenses (discord_id);
create index if not exists script_licenses_status_idx on public.script_licenses (status);
create index if not exists script_licenses_hwid_hash_idx on public.script_licenses (hwid_hash);
create index if not exists script_auth_logs_license_key_idx on public.script_auth_logs (license_key);
create index if not exists script_auth_logs_created_at_idx on public.script_auth_logs (created_at desc);

alter table public.script_licenses enable row level security;
alter table public.script_auth_logs enable row level security;

drop policy if exists "Server can manage script licenses" on public.script_licenses;
create policy "Server can manage script licenses"
  on public.script_licenses
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can write script auth logs" on public.script_auth_logs;
create policy "Server can write script auth logs"
  on public.script_auth_logs
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.script_licenses from anon, authenticated;
revoke all on table public.script_auth_logs from anon, authenticated;

grant select, insert, update, delete on table public.script_licenses to service_role;
grant select, insert, update, delete on table public.script_auth_logs to service_role;
