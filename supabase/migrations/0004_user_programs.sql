-- M3 : programme généré par l'IA pour chaque utilisateur
-- À exécuter dans Supabase → SQL Editor, après 0003_exercises.sql.

create table public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  current_week int not null default 1,
  structure jsonb not null,
  generation_prompt_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_programs enable row level security;

create policy "Users manage their own programs"
  on public.user_programs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
