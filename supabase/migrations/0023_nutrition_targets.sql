-- Cibles de macros personnalisées par l'utilisateur (override du calcul auto).
-- Quand une ligne existe, elle prime sur les cibles déduites du profil.
-- On stocke le total calorique et la répartition en % ; les grammes sont
-- recalculés côté client (macrosFromSplit).
create table public.nutrition_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kcal integer not null check (kcal > 0),
  protein_pct integer not null default 30 check (protein_pct between 0 and 100),
  carbs_pct integer not null default 40 check (carbs_pct between 0 and 100),
  fat_pct integer not null default 30 check (fat_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_targets enable row level security;

create policy "Users manage their own nutrition targets"
  on public.nutrition_targets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
