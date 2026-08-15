-- Nutrition façon MyFitnessPal : repas typés + recettes réutilisables.

-- 1) Type de repas sur chaque aliment du journal.
alter table public.food_entries add column meal_type text;

-- Autorise la source 'recipe' (aliment ajouté depuis une recette enregistrée).
alter table public.food_entries drop constraint food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check
  check (source in ('manual', 'photo', 'barcode', 'plan', 'recipe'));

-- 2) Recettes / plats enregistrés par l'utilisateur (macros totales + portions).
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  servings int not null default 1 check (servings >= 1),
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "Users manage their own recipes"
  on public.recipes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Ingrédients d'une recette (pour l'affichage / l'édition).
create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity_g numeric,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0
);

alter table public.recipe_items enable row level security;

create policy "Users manage their own recipe items"
  on public.recipe_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
