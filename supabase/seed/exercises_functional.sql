-- Complément au seed initial : mouvements fonctionnels / cardio / explosifs
-- (Hyrox, course, sports co, plyométrie). À exécuter après exercises.sql.
-- Le champ "reps" du programme généré reste du texte libre — l'IA peut y
-- écrire une durée ("30s") ou une distance ("400m") pour ces exercices,
-- pas seulement un nombre de répétitions.

insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions) values
  ('Jumping jacks', 'cardio', 'full_body', '{bodyweight}', '{shoulder}', 'Départ pieds joints bras le long du corps, saute en écartant simultanément jambes et bras au-dessus de la tête, reviens à la position de départ.'),
  ('Corde à sauter', 'cardio', 'full_body', '{bodyweight}', '{knee}', 'Sauts légers et réguliers, poignets qui font tourner la corde, atterrissage sur l''avant du pied.'),
  ('Squats sautés', 'cardio', 'legs', '{bodyweight}', '{knee}', 'Descends en squat puis explose vers le haut en sautant, atterris souplement en repartant directement en squat.'),
  ('Fentes sautées', 'cardio', 'legs', '{bodyweight}', '{knee}', 'En position de fente, saute et change de jambe en l''air, atterris directement en fente inversée.'),
  ('Montées de genoux', 'cardio', 'legs', '{bodyweight}', '{knee}', 'Sur place, ramène rapidement et alternativement chaque genou vers la poitrine, bras qui accompagnent le mouvement.'),
  ('Sauts en longueur', 'cardio', 'legs', '{bodyweight}', '{knee}', 'Départ pieds joints, prends de l''élan avec les bras et saute le plus loin possible, atterris souplement sur les deux pieds.'),
  ('Wall balls', 'cardio', 'full_body', '{dumbbell}', '{lower_back,shoulder}', 'Charge tenue à hauteur de poitrine, descends en squat puis explose vers le haut en poussant la charge au-dessus de la tête.'),
  ('Portage de charges', 'cardio', 'full_body', '{dumbbell}', '{lower_back}', 'Une charge dans chaque main, marche à rythme soutenu en gardant le buste droit et les épaules basses.'),
  ('Rameur (intervalles)', 'cardio', 'full_body', '{machine}', '{lower_back}', 'Poussée des jambes puis tirage du buste et des bras, retour contrôlé — alterne phases rapides et phases de récupération.'),
  ('Vélo air (assault bike)', 'cardio', 'full_body', '{machine}', '{}', 'Pédale en poussant/tirant simultanément sur les poignées mobiles, alterne intervalles rapides et récupération.'),
  ('Battle ropes', 'cardio', 'full_body', '{machine}', '{shoulder,lower_back}', 'Une extrémité de corde dans chaque main, crée des vagues alternées ou simultanées à rythme soutenu.'),
  ('Step-ups explosifs', 'cardio', 'legs', '{dumbbell}', '{knee}', 'Monte sur un step ou banc en explosant vers le haut, redescends contrôlé, alterne les jambes.');
