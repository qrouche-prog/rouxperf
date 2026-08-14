-- Distance parcourue pour une série d'endurance (course, cardio), en km.
-- Complète metric_kind/metric_value : on peut renseigner à la fois la distance
-- et une allure/vitesse/temps pour une même série (ex. sortie longue).
-- Pour l'allure, metric_kind='pace' et metric_value = secondes par km.
alter table public.workout_log_sets
  add column distance_km numeric;
