-- M3 : bibliothèque d'exercices, ancre la génération IA
-- À exécuter dans Supabase → SQL Editor, après 0001 et 0002.
-- Lecture publique (utilisateurs authentifiés), écriture uniquement via SQL Editor/seed.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('compound', 'isolation', 'cardio', 'mobility')),
  muscle_group text not null check (
    muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'cardio')
  ),
  equipment_required text[] not null default '{}',
  contraindications text[] not null default '{}',
  instructions text not null,
  video_url text,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Authenticated users can read exercises"
  on public.exercises for select
  to authenticated
  using (true);
