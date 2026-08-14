-- Dernière analyse IA de la charge d'entraînement, par utilisateur.
-- Générée à la demande par la fonction training-insights (rôle service) ;
-- l'utilisateur lit la sienne.
create table public.training_insights (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null,
  generated_at timestamptz not null default now()
);

alter table public.training_insights enable row level security;

create policy "Users read their own insights"
  on public.training_insights for select
  using (user_id = auth.uid());
