create table if not exists public.shora_products (
  id text primary key,
  data jsonb not null,
  source text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shora_inventory (
  product_id text primary key,
  stock integer not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.shora_deleted_products (
  product_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.shora_wallets (
  user_id text primary key,
  data jsonb not null,
  balance_satang integer not null default 0 check (balance_satang >= 0),
  currency text not null default 'THB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shora_topups (
  id text primary key,
  user_id text,
  voucher_hash text,
  status text not null default '',
  amount_satang integer not null default 0 check (amount_satang >= 0),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shora_orders (
  id text primary key,
  user_id text,
  contact text,
  status text not null default '',
  amount_satang integer not null default 0 check (amount_satang >= 0),
  license_key text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shora_license_keys (
  license_key text primary key,
  contact text,
  status text not null default 'active',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shora_script_sources (
  id text primary key default 'main',
  source text not null default '',
  kind text not null default 'database',
  updated_at timestamptz not null default now()
);

create index if not exists shora_orders_user_id_idx on public.shora_orders (user_id);
create index if not exists shora_orders_created_at_idx on public.shora_orders (created_at desc);
create index if not exists shora_topups_user_id_idx on public.shora_topups (user_id);
create index if not exists shora_topups_voucher_hash_idx on public.shora_topups (voucher_hash);
create index if not exists shora_license_keys_contact_idx on public.shora_license_keys (contact);
create index if not exists shora_license_keys_status_idx on public.shora_license_keys (status);

alter table public.shora_products enable row level security;
alter table public.shora_inventory enable row level security;
alter table public.shora_deleted_products enable row level security;
alter table public.shora_wallets enable row level security;
alter table public.shora_topups enable row level security;
alter table public.shora_orders enable row level security;
alter table public.shora_license_keys enable row level security;
alter table public.shora_script_sources enable row level security;

drop policy if exists "Server can manage shora products" on public.shora_products;
create policy "Server can manage shora products"
  on public.shora_products
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora inventory" on public.shora_inventory;
create policy "Server can manage shora inventory"
  on public.shora_inventory
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora deleted products" on public.shora_deleted_products;
create policy "Server can manage shora deleted products"
  on public.shora_deleted_products
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora wallets" on public.shora_wallets;
create policy "Server can manage shora wallets"
  on public.shora_wallets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora topups" on public.shora_topups;
create policy "Server can manage shora topups"
  on public.shora_topups
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora orders" on public.shora_orders;
create policy "Server can manage shora orders"
  on public.shora_orders
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora license keys" on public.shora_license_keys;
create policy "Server can manage shora license keys"
  on public.shora_license_keys
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Server can manage shora script sources" on public.shora_script_sources;
create policy "Server can manage shora script sources"
  on public.shora_script_sources
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.shora_products from anon, authenticated;
revoke all on table public.shora_inventory from anon, authenticated;
revoke all on table public.shora_deleted_products from anon, authenticated;
revoke all on table public.shora_wallets from anon, authenticated;
revoke all on table public.shora_topups from anon, authenticated;
revoke all on table public.shora_orders from anon, authenticated;
revoke all on table public.shora_license_keys from anon, authenticated;
revoke all on table public.shora_script_sources from anon, authenticated;

grant select, insert, update, delete on table public.shora_products to service_role;
grant select, insert, update, delete on table public.shora_inventory to service_role;
grant select, insert, update, delete on table public.shora_deleted_products to service_role;
grant select, insert, update, delete on table public.shora_wallets to service_role;
grant select, insert, update, delete on table public.shora_topups to service_role;
grant select, insert, update, delete on table public.shora_orders to service_role;
grant select, insert, update, delete on table public.shora_license_keys to service_role;
grant select, insert, update, delete on table public.shora_script_sources to service_role;
