-- M3 (suite) : validation manuelle avant génération réelle (coût IA payé de
-- la poche de l'admin tant qu'il n'y a pas de paiement sur le site).
-- À exécuter dans Supabase → SQL Editor, après 0010_ai_generated_exercises.sql.

alter table public.user_programs drop constraint user_programs_status_check;

alter table public.user_programs add constraint user_programs_status_check
  check (status in ('pending_approval', 'generating', 'active', 'completed', 'archived', 'failed'));
