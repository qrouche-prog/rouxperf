-- Connexion intervals.icu (gratuit ; agrège Garmin, Strava, etc.).
-- Comme pour Strava : statut lisible + secret (clé API) réservé au rôle service.

create table public.intervals_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id text,
  connected_at timestamptz not null default now()
);

alter table public.intervals_connections enable row level security;

create policy "Users read their own intervals connection"
  on public.intervals_connections for select
  using (user_id = auth.uid());

create policy "Users delete their own intervals connection"
  on public.intervals_connections for delete
  using (user_id = auth.uid());

create table public.intervals_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.intervals_secrets enable row level security;
-- Pas de policy : clé API accessible uniquement en rôle service (Edge Functions).
