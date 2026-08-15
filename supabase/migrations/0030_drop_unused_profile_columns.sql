-- Nettoyage : colonnes jamais écrites par l'onboarding ni lues par le worker.
-- - days_per_week : remplacé par preferred_days + les fréquences de
--   focus_area_preferences (le nombre de séances en découle).
-- - session_mode : la question « mode guidé / libre » a été retirée du produit.
-- Sans impact fonctionnel. Optionnel.
alter table public.user_training_profile drop column if exists days_per_week;
alter table public.profiles drop column if exists session_mode;
alter table public.user_training_profile drop column if exists session_mode;
