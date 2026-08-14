-- Connexion Strava (agrégateur gratuit ; Garmin s'y synchronise automatiquement).
-- Deux tables : le statut (lisible par l'utilisateur) et les jetons OAuth
-- (accessibles UNIQUEMENT en rôle service via les Edge Functions).

create table public.strava_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint,
  scope text,
  connected_at timestamptz not null default now()
);

alter table public.strava_connections enable row level security;

create policy "Users read their own strava connection"
  on public.strava_connections for select
  using (user_id = auth.uid());

create policy "Users delete their own strava connection"
  on public.strava_connections for delete
  using (user_id = auth.uid());

-- Jetons OAuth : pas de policy → inaccessibles au client, seul le rôle service
-- (Edge Functions) peut lire/écrire. On ne les expose jamais au navigateur.
create table public.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.strava_tokens enable row level security;
