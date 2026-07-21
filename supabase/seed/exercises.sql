-- Seed de la bibliothèque d'exercices — à exécuter après 0003_exercises.sql.
-- Ré-exécutable : ON CONFLICT DO NOTHING (basé sur le nom, pas de contrainte unique
-- explicite en v1, donc on vide et on réinsère si besoin de re-seed).

insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions) values
  ('Squat au poids du corps', 'compound', 'legs', '{bodyweight}', '{knee}', 'Pieds largeur d''épaules, descends en pliant hanches et genoux jusqu''à cuisses parallèles au sol, remonte en poussant sur les talons.'),
  ('Pompes', 'compound', 'chest', '{bodyweight}', '{shoulder,wrist}', 'Mains largeur d''épaules, corps gainé et aligné, descends la poitrine près du sol puis pousse pour remonter.'),
  ('Fentes avant', 'compound', 'legs', '{bodyweight}', '{knee}', 'Grand pas en avant, descends jusqu''à ce que les deux genoux forment un angle droit, reviens en poussant sur la jambe avant.'),
  ('Planche', 'isolation', 'core', '{bodyweight}', '{lower_back,wrist}', 'Appui sur avant-bras et pointes de pieds, corps aligné de la tête aux talons, gaine le tronc et maintiens la position.'),
  ('Pont fessier', 'isolation', 'legs', '{bodyweight}', '{lower_back}', 'Allongé sur le dos, genoux pliés, pousse les hanches vers le haut en contractant les fessiers, redescends contrôlé.'),
  ('Mountain climbers', 'cardio', 'full_body', '{bodyweight}', '{wrist,shoulder}', 'Position de planche haute, ramène alternativement les genoux vers la poitrine à rythme soutenu.'),
  ('Burpees', 'cardio', 'full_body', '{bodyweight}', '{knee,shoulder,wrist}', 'Squat, place les mains au sol, saute les pieds en arrière en planche, pompe optionnelle, ramène les pieds et saute vers le haut.'),
  ('Superman', 'isolation', 'back', '{bodyweight}', '{lower_back}', 'Allongé sur le ventre, lève simultanément bras et jambes tendus, maintiens puis redescends contrôlé.'),

  ('Squat gobelet haltère', 'compound', 'legs', '{bodyweight,dumbbell}', '{knee}', 'Tiens un haltère contre la poitrine à deux mains, descends en squat en gardant le buste droit, remonte.'),
  ('Rowing haltère unilatéral', 'compound', 'back', '{bodyweight,dumbbell}', '{lower_back}', 'Un genou et une main en appui sur un banc, tire l''haltère vers la hanche en gardant le dos plat.'),
  ('Développé épaules haltères', 'compound', 'shoulders', '{bodyweight,dumbbell}', '{shoulder}', 'Assis ou debout, pousse les haltères au-dessus de la tête depuis la hauteur des épaules, redescends contrôlé.'),
  ('Soulevé de terre roumain haltères', 'compound', 'legs', '{bodyweight,dumbbell}', '{lower_back}', 'Haltères devant les cuisses, hanches reculent en gardant le dos plat et les jambes légèrement fléchies, redescends jusqu''à tension des ischios.'),
  ('Curl biceps haltères', 'isolation', 'arms', '{bodyweight,dumbbell}', '{}', 'Coudes fixes le long du corps, plie les bras pour amener les haltères vers les épaules, redescends contrôlé.'),
  ('Extension triceps haltère', 'isolation', 'arms', '{bodyweight,dumbbell}', '{shoulder}', 'Haltère tenu à deux mains derrière la tête, coudes fixes, tends les bras vers le haut puis redescends.'),
  ('Élévations latérales haltères', 'isolation', 'shoulders', '{bodyweight,dumbbell}', '{shoulder}', 'Haltères le long du corps, lève les bras sur les côtés jusqu''à hauteur d''épaules, redescends contrôlé.'),

  ('Développé couché haltères', 'compound', 'chest', '{dumbbell,bench}', '{shoulder}', 'Allongé sur un banc, pousse les haltères depuis la poitrine vers le haut, redescends contrôlé.'),
  ('Développé incliné haltères', 'compound', 'chest', '{dumbbell,bench}', '{shoulder}', 'Sur banc incliné, pousse les haltères depuis la poitrine vers le haut, redescends contrôlé.'),
  ('Tractions', 'compound', 'back', '{bodyweight,pull_up_bar}', '{shoulder}', 'Suspendu à la barre, tire le corps vers le haut jusqu''à ce que le menton dépasse la barre, redescends contrôlé.'),
  ('Dips', 'compound', 'chest', '{bodyweight,bench}', '{shoulder,wrist}', 'Appui sur deux surfaces parallèles ou un banc, descends en pliant les coudes puis pousse pour remonter.'),
  ('Kettlebell swing', 'compound', 'full_body', '{kettlebell}', '{lower_back}', 'Kettlebell entre les jambes, propulse-la à hauteur de poitrine par une extension explosive des hanches.'),
  ('Goblet lunge kettlebell', 'compound', 'legs', '{kettlebell}', '{knee}', 'Kettlebell tenue contre la poitrine, effectue des fentes avant en gardant le buste droit.'),

  ('Squat arrière barre', 'compound', 'legs', '{barbell}', '{knee,lower_back}', 'Barre sur le haut du dos, descends en squat jusqu''à cuisses parallèles, remonte en poussant sur les talons.'),
  ('Soulevé de terre barre', 'compound', 'back', '{barbell}', '{lower_back}', 'Barre au sol, pieds largeur bassin, saisis la barre et redresse le buste en gardant le dos plat, hanches et genoux en extension simultanée.'),
  ('Développé couché barre', 'compound', 'chest', '{barbell,bench}', '{shoulder}', 'Allongé sur un banc, descends la barre jusqu''à la poitrine puis pousse pour remonter.'),
  ('Développé militaire barre', 'compound', 'shoulders', '{barbell}', '{shoulder,lower_back}', 'Debout, pousse la barre depuis la hauteur des épaules jusqu''au-dessus de la tête.'),
  ('Rowing barre', 'compound', 'back', '{barbell}', '{lower_back}', 'Buste penché en avant, dos plat, tire la barre vers l''abdomen puis redescends contrôlé.'),

  ('Tirage vertical poulie', 'compound', 'back', '{cable_machine}', '{shoulder}', 'Assis face à la poulie haute, tire la barre vers le haut de la poitrine en resserrant les omoplates.'),
  ('Presse à cuisses', 'compound', 'legs', '{machine}', '{knee,lower_back}', 'Assis sur la presse, pousse la plateforme en tendant les jambes sans verrouiller complètement les genoux.'),
  ('Rowing poulie basse', 'compound', 'back', '{cable_machine}', '{lower_back}', 'Assis face à la poulie basse, tire la poignée vers l''abdomen en gardant le dos droit.'),
  ('Leg curl machine', 'isolation', 'legs', '{machine}', '{knee}', 'Allongé ou assis sur la machine, plie les genoux pour amener les mollets vers les ischios.'),
  ('Développé assis machine', 'compound', 'chest', '{machine}', '{shoulder}', 'Assis face à la machine, pousse les poignées vers l''avant jusqu''à extension des bras.');
