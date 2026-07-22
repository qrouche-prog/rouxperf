-- M4 : séances réellement effectuées (distinct de body_measurements)
-- À exécuter dans Supabase → SQL Editor, après 0004_user_programs.sql.
-- week_number/day_number pointent vers une entrée de user_programs.structure
-- (jsonb) plutôt qu'une FK relationnelle.

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.user_programs (id) on delete set null,
  week_number int not null,
  day_number int not null,
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_logs enable row level security;

create policy "Users manage their own workout logs"
  on public.workout_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.workout_log_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  set_number int not null,
  reps int,
  weight_kg numeric,
  rpe numeric,
  created_at timestamptz not null default now()
);

alter table public.workout_log_sets enable row level security;

create policy "Users manage their own workout log sets"
  on public.workout_log_sets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
