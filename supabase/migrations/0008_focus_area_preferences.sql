-- M3 (suite) : fréquence hebdomadaire et mode d'intégration (intégré aux
-- séances de musculation vs séances dédiées) par aspect à travailler
-- (focus_areas), pour que le programme généré planifie vraiment ces
-- domaines plutôt que de simplement en tenir compte "en façade".
-- À exécuter dans Supabase → SQL Editor, après 0007_async_generation.sql.

alter table public.user_training_profile add column focus_area_preferences jsonb;
