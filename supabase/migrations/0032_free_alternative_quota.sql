-- M32 : horodatage de la dernière alternative d'exercice gratuite utilisée
-- (non-abonnés : 1 aperçu gratuit par semaine, écriture directe côté client
-- via la policy update déjà existante sur profiles — pas de coût IA).
alter table public.profiles
  add column last_free_alternative_at timestamptz;
