-- Journal alimentaire : une ligne par aliment consommé.
-- Les cibles de macros sont calculées côté client à partir du profil
-- (poids, taille, âge, sexe, objectif) — pas stockées ici.
-- `source` distingue une saisie manuelle d'une future entrée par photo ou
-- code-barres.
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consumed_on date not null default ((now() at time zone 'utc')::date),
  name text not null,
  quantity_g numeric,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  source text not null default 'manual' check (source in ('manual', 'photo', 'barcode')),
  created_at timestamptz not null default now()
);

alter table public.food_entries enable row level security;

create policy "Users manage their own food entries"
  on public.food_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index food_entries_user_day on public.food_entries (user_id, consumed_on);
