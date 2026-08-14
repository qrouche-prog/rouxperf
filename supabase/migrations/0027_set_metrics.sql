-- Métrique alternative pour une série qui ne se mesure pas en poids × reps :
-- cardio / ergo (temps, distance) et course à pied (vitesse, temps, distance),
-- ainsi que le temps d'effort des exercices chronométrés.
--   metric_kind : 'effort_s' (secondes d'effort), 'speed' (km/h),
--                 'time' (minutes), 'distance' (km).
alter table public.workout_log_sets
  add column metric_kind text,
  add column metric_value numeric;
