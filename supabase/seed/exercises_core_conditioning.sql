-- Extension de la bibliothèque : travail du tronc (abdos/gainage), cardio doux
-- (perte de poids) et accessoires de renforcement. À exécuter une fois dans le
-- SQL Editor, après exercises.sql. Idempotent via l'index unique sur le nom.
create unique index if not exists exercises_name_key on public.exercises (name);

insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions) values
  -- ---- Tronc / abdos (le gros manque) ----
  ('Crunch', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé sur le dos, genoux fléchis, décolle les omoplates en enroulant le buste vers les cuisses, expire, puis redescends contrôlé sans relâcher.'),
  ('Crunch inversé', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé sur le dos, ramène les genoux vers la poitrine en décollant le bassin, contracte les abdos du bas, puis redescends lentement.'),
  ('Relevé de jambes allongé', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé sur le dos, jambes tendues, lève-les jusqu''à la verticale sans creuser le bas du dos, puis redescends lentement sans toucher le sol.'),
  ('Relevé de jambes suspendu', 'isolation', 'core', '{bodyweight,pull_up_bar}', '{shoulder,lower_back}', 'Suspendu à la barre, monte les jambes tendues ou genoux fléchis vers la poitrine en contrôlant, puis redescends sans balancer.'),
  ('Gainage latéral', 'isolation', 'core', '{bodyweight}', '{shoulder,wrist}', 'Appui sur un avant-bras et le côté du pied, corps aligné, hanches hautes, gaine les obliques et maintiens la position de chaque côté.'),
  ('Dead bug', 'isolation', 'core', '{bodyweight}', '{}', 'Allongé sur le dos, bras et genoux fléchis vers le plafond, tends bras et jambe opposés vers le sol en gardant le bas du dos plaqué, reviens et alterne.'),
  ('Hollow hold', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé sur le dos, décolle épaules et jambes tendues, bas du dos plaqué au sol, maintiens la position gainée en creux.'),
  ('Crunch vélo', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé, mains aux tempes, amène alternativement coude vers le genou opposé en pédalant, en tournant le buste sans tirer sur la nuque.'),
  ('Russian twists', 'isolation', 'core', '{bodyweight,dumbbell}', '{lower_back}', 'Assis, buste incliné en arrière, pieds décollés ou au sol, tourne le buste d''un côté à l''autre en contrôlant, avec ou sans charge.'),
  ('Crunch à la poulie', 'isolation', 'core', '{cable_machine}', '{lower_back}', 'À genoux face à la poulie haute, corde derrière la nuque, enroule le buste vers le sol en contractant les abdos, puis reviens contrôlé.'),
  ('Crunch machine', 'isolation', 'core', '{machine}', '{lower_back}', 'Assis sur la machine à abdos, enroule le buste vers l''avant contre la résistance en soufflant, puis reviens lentement.'),
  ('Extension lombaire au sol', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'Allongé sur le ventre, décolle légèrement le buste en contractant les lombaires sans hyperextension, maintiens puis redescends.'),

  -- ---- Cardio doux / perte de poids (dispo pour tous : équipement vide) ----
  ('Marche rapide inclinée', 'cardio', 'cardio', '{}', '{}', 'Sur tapis incliné (8-15 %) ou une côte, marche à allure soutenue en gardant une posture droite ; effort modéré et continu, idéal pour brûler des calories sans impact.'),
  ('Montée d''escaliers', 'cardio', 'cardio', '{}', '{knee}', 'Sur stairmaster ou dans des escaliers, monte à rythme régulier sans t''appuyer lourdement sur les rampes ; effort continu modéré à soutenu.'),
  ('Vélo (endurance modérée)', 'cardio', 'cardio', '{}', '{}', 'Sur vélo d''appartement ou route, pédale à intensité modérée et régulière permettant de tenir une conversation ; travail cardio à faible impact.'),
  ('Elliptique', 'cardio', 'cardio', '{}', '{}', 'Sur elliptique, mouvement fluide et continu bras et jambes, intensité modérée à soutenue ; cardio complet sans impact articulaire.'),
  ('Rameur (endurance modérée)', 'cardio', 'cardio', '{}', '{lower_back}', 'Sur rameur, enchaîne des cycles réguliers jambes-buste-bras en gardant le dos droit ; effort continu modéré, cardio complet.'),

  -- ---- Accessoires de renforcement (variété, équilibre) ----
  ('Hip thrust barre', 'compound', 'legs', '{barbell,bench}', '{lower_back}', 'Haut du dos appuyé sur un banc, barre sur les hanches, pousse le bassin vers le haut en contractant les fessiers jusqu''à alignement, puis redescends contrôlé.'),
  ('Fente bulgare', 'compound', 'legs', '{bodyweight,bench}', '{knee}', 'Pied arrière surélevé sur un banc, descends en fléchissant la jambe avant jusqu''à cuisse parallèle, remonte en poussant sur le talon avant.'),
  ('Mollets debout', 'isolation', 'legs', '{bodyweight}', '{}', 'Debout, monte sur la pointe des pieds en contractant les mollets, pause en haut, puis redescends lentement ; avec charge (haltères) pour progresser.'),
  ('Face pull poulie', 'isolation', 'shoulders', '{cable_machine}', '{shoulder}', 'Poulie à hauteur du visage, tire la corde vers le front en écartant les mains et en resserrant les omoplates ; renforce l''arrière d''épaule et la posture.'),
  ('Oiseau haltères', 'isolation', 'shoulders', '{bodyweight,dumbbell}', '{shoulder}', 'Buste penché en avant, dos plat, écarte les haltères sur les côtés jusqu''à hauteur d''épaules en contractant l''arrière des épaules, redescends contrôlé.'),
  ('Écarté couché haltères', 'isolation', 'chest', '{dumbbell,bench}', '{shoulder}', 'Allongé sur un banc, bras légèrement fléchis, ouvre les haltères en arc de cercle jusqu''à étirement de la poitrine, puis referme en contractant les pectoraux.'),
  ('Curl marteau haltères', 'isolation', 'arms', '{bodyweight,dumbbell}', '{}', 'Haltères en prise neutre (paumes face à face), plie les bras en gardant les coudes fixes, puis redescends contrôlé ; cible biceps et avant-bras.'),
  ('Good morning barre', 'compound', 'legs', '{barbell}', '{lower_back}', 'Barre sur le haut du dos, jambes légèrement fléchies, penche le buste vers l''avant en reculant les hanches, dos plat, jusqu''à tension des ischios, puis redresse.')
on conflict (name) do nothing;
