-- Demandes d'ajustement du programme formulées par les abonnés Premium
-- (texte libre pris en compte par l'IA à la génération suivante).
-- Limité à 1 par semaine côté fonction adjust-program.
-- Écrit par le rôle service (fonction adjust-program) ; l'utilisateur lit
-- les siennes pour afficher la date de la prochaine demande possible.
create table public.program_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.program_adjustments enable row level security;

create policy "Users read their own program adjustments"
  on public.program_adjustments for select
  using (user_id = auth.uid());

create index program_adjustments_user_created
  on public.program_adjustments (user_id, created_at desc);
