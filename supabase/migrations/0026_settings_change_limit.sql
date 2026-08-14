-- Horodatage de la dernière modification de réglages liés au programme.
-- Sert à limiter les modifications à 1 par semaine (abonnés Premium), au même
-- titre que l'ajustement depuis le tableau de bord.
alter table public.profiles
  add column last_program_settings_change_at timestamptz;
