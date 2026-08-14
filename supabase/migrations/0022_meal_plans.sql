-- Dernier plan repas généré par l'IA, par utilisateur.
-- Généré à la demande par la fonction generate-meal-plan (rôle service) à
-- partir des cibles de macros ; l'utilisateur lit le sien.
create table public.meal_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content jsonb not null,
  targets jsonb,
  generated_at timestamptz not null default now()
);

alter table public.meal_plans enable row level security;

create policy "Users read their own meal plan"
  on public.meal_plans for select
  using (user_id = auth.uid());

-- Autorise la source 'plan' pour les aliments ajoutés au journal depuis un
-- plan repas généré.
alter table public.food_entries drop constraint food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check
  check (source in ('manual', 'photo', 'barcode', 'plan'));
