-- Intégration montres connectées via Terra (agrégateur : Garmin, Apple, Fitbit…).
-- terra_connections : mappe l'utilisateur Terra ↔ l'utilisateur rouxperf.
-- wearable_activities : séances importées, normalisées par Terra.
-- Les écritures se font par le webhook (rôle service, hors RLS) ; le client
-- ne fait que lire ses propres lignes.

create table public.terra_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  terra_user_id text not null,
  provider text,
  connected_at timestamptz not null default now(),
  primary key (user_id, terra_user_id)
);

alter table public.terra_connections enable row level security;

create policy "Users read their own terra connections"
  on public.terra_connections for select
  using (user_id = auth.uid());

create index terra_connections_terra_uid on public.terra_connections (terra_user_id);

create table public.wearable_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'terra',
  provider text,
  external_id text,
  activity_type text,
  started_at timestamptz,
  duration_s integer,
  distance_m numeric,
  calories numeric,
  avg_hr integer,
  max_hr integer,
  elevation_gain_m numeric,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.wearable_activities enable row level security;

create policy "Users read their own wearable activities"
  on public.wearable_activities for select
  using (user_id = auth.uid());

-- Import manuel de fichiers (.tcx/.gpx) : l'utilisateur écrit ses propres
-- séances depuis le client. Le webhook Terra, lui, écrit en rôle service
-- (hors RLS). Ces policies n'ouvrent que les lignes de l'utilisateur.
create policy "Users insert their own wearable activities"
  on public.wearable_activities for insert
  with check (user_id = auth.uid());

create policy "Users update their own wearable activities"
  on public.wearable_activities for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own wearable activities"
  on public.wearable_activities for delete
  using (user_id = auth.uid());

create index wearable_activities_user_started on public.wearable_activities (user_id, started_at desc);
