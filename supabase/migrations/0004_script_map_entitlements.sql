alter table public.script_licenses
  add column if not exists allowed_maps jsonb not null default '[]'::jsonb;

alter table public.script_auth_logs
  add column if not exists map_slug text,
  add column if not exists game_id text,
  add column if not exists place_id text,
  add column if not exists creator_id text;

create index if not exists script_licenses_allowed_maps_idx
  on public.script_licenses
  using gin (allowed_maps);

create index if not exists script_auth_logs_map_slug_idx
  on public.script_auth_logs (map_slug);
