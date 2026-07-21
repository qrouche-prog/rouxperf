-- M2 : tables de l'onboarding (mesures, objectifs, profil d'entraînement)
-- À exécuter dans Supabase → SQL Editor, après 0001_init.sql.

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hips_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.body_measurements enable row level security;

create policy "Users manage their own measurements"
  on public.body_measurements for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null check (
    goal_type in ('weight_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness', 'recomposition')
  ),
  target_weight_kg numeric,
  target_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users manage their own goals"
  on public.goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Un seul objectif actif à la fois par utilisateur.
create unique index goals_one_active_per_user
  on public.goals (user_id)
  where is_active;

create table public.user_training_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  years_training numeric,
  equipment_access text check (
    equipment_access in ('bodyweight', 'home_dumbbells', 'home_full_gym', 'commercial_gym')
  ),
  days_per_week int check (days_per_week between 1 and 7),
  session_duration_minutes int,
  preferred_days int[],
  injuries_limitations text,
  updated_at timestamptz not null default now()
);

alter table public.user_training_profile enable row level security;

create policy "Users manage their own training profile"
  on public.user_training_profile for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
