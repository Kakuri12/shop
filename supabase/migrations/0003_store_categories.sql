create table if not exists public.shora_categories (
  slug text primary key,
  data jsonb not null,
  source text not null default 'custom',
  hidden boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shora_categories_hidden_idx on public.shora_categories (hidden);
create index if not exists shora_categories_position_idx on public.shora_categories (position);

alter table public.shora_categories enable row level security;

drop policy if exists "Server can manage shora categories" on public.shora_categories;
create policy "Server can manage shora categories"
  on public.shora_categories
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.shora_categories from anon, authenticated;
grant select, insert, update, delete on table public.shora_categories to service_role;
