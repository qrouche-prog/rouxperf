-- Complément au seed : la bibliothèque ne contenait aucun exercice de course
-- à pied à proprement parler (seulement du HIIT bodyweight/machine), donc
-- l'IA ne pouvait jamais générer de séance de course même quand le focus
-- "running" était sélectionné — le exercise_id doit exister en base.
-- À exécuter après exercises_functional.sql.

insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions) values
  ('Course à pied (endurance fondamentale)', 'cardio', 'legs', '{bodyweight}', '{knee,ankle}', 'Course continue à allure modérée (tu peux tenir une conversation), sur route, chemin ou tapis. Le champ reps exprime la durée ("30min") ou la distance ("5km").'),
  ('Footing de récupération', 'cardio', 'legs', '{bodyweight}', '{knee,ankle}', 'Course très facile à allure lente, objectif récupération active plutôt que performance. Le champ reps exprime la durée ("20min") ou la distance.'),
  ('Course fractionnée (intervalles courts)', 'cardio', 'legs', '{bodyweight}', '{knee,ankle}', 'Alterne portions rapides (proches de l''allure 5km) et portions de récupération en trot ou marche, ex. 30s rapide / 30s récupération. Le champ reps exprime le format ("10x400m" ou "8x30s").'),
  ('Course fractionnée (intervalles longs / seuil)', 'cardio', 'legs', '{bodyweight}', '{knee,ankle}', 'Portions longues à allure seuil (soutenue mais contrôlée) entrecoupées de récupération courte, ex. 4x1000m. Le champ reps exprime le format.'),
  ('Sprints', 'cardio', 'legs', '{bodyweight}', '{knee,ankle,hamstring}', 'Efforts brefs à intensité maximale (8-15s) avec récupération complète entre chaque répétition. Le champ reps exprime le format ("6x60m").'),
  ('Côtes en course', 'cardio', 'legs', '{bodyweight}', '{knee,ankle}', 'Sprints ou efforts soutenus en montée, redescente en marche/trot pour la récupération. Le champ reps exprime le format ("8x20s côte").');
