-- Exercices de rééducation / mobilité / activation — indispensables pour bâtir
-- des programmes sûrs en grossesse, post-partum et rééducation. Sans eux, l'IA
-- ne peut pas proposer respiration, plancher pelvien, transverse, mobilité
-- douce (interdiction d'inventer un mouvement de renfo). À exécuter une fois.
insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions)
select v.name, v.category, v.muscle_group, v.equipment_required::text[], v.contraindications::text[], v.instructions
from (values
  ('Respiration diaphragmatique', 'mobility', 'core', '{bodyweight}', '{}', 'Allongé ou assis, inspire par le nez en gonflant les côtes et le ventre à 360°, expire lentement en engageant doucement le transverse ; base de la reconstruction du tronc.'),
  ('Activation du plancher pelvien', 'mobility', 'core', '{bodyweight}', '{}', 'À l''expiration, contracte doucement le plancher pelvien (comme pour retenir une envie d''uriner) sans bloquer la respiration, relâche complètement à l''inspiration ; essentiel en pré/post-natal.'),
  ('Activation du transverse', 'mobility', 'core', '{bodyweight}', '{}', 'Allongé genoux fléchis, expire en rentrant légèrement le nombril vers la colonne sans bouger le bassin ni bloquer la respiration ; réveille la sangle abdominale profonde.'),
  ('Bascule du bassin', 'mobility', 'core', '{bodyweight}', '{}', 'Allongé sur le dos, genoux fléchis, bascule doucement le bassin en plaquant puis creusant légèrement le bas du dos, en douceur et sans forcer.'),
  ('Chat-vache', 'mobility', 'back', '{bodyweight}', '{}', 'À quatre pattes, alterne dos rond (expire) et dos creux (inspire) en suivant la respiration ; mobilité douce de la colonne.'),
  ('Bird dog', 'isolation', 'core', '{bodyweight}', '{}', 'À quatre pattes, tends bras et jambe opposés à l''horizontale en gardant le bassin stable et le dos neutre, reviens contrôlé, alterne ; anti-rotation, sûr pour le tronc.'),
  ('Marche du pont fessier', 'isolation', 'core', '{bodyweight}', '{lower_back}', 'En position de pont fessier (bassin levé), décolle alternativement un pied puis l''autre en gardant le bassin stable ; gainage et fessiers en douceur.'),
  ('Clamshell', 'isolation', 'legs', '{bodyweight}', '{}', 'Allongé sur le côté, genoux fléchis, ouvre le genou du dessus en gardant les pieds joints et le bassin immobile ; renforce le moyen fessier.'),
  ('Élévation latérale de jambe', 'isolation', 'legs', '{bodyweight}', '{}', 'Allongé sur le côté, jambe tendue, lève-la contrôlée jusqu''à ~45° puis redescends ; renforcement latéral de hanche à faible risque.'),
  ('Rotation thoracique quadrupédie', 'mobility', 'back', '{bodyweight}', '{}', 'À quatre pattes, main derrière la tête, ouvre le coude vers le plafond en tournant le buste, reviens ; mobilité thoracique.'),
  ('Étirement des fléchisseurs de hanche', 'mobility', 'legs', '{bodyweight}', '{}', 'En fente genou au sol, avance doucement le bassin pour étirer l''avant de la hanche de la jambe arrière, sans creuser le bas du dos.'),
  ('Marche active', 'cardio', 'cardio', '{}', '{}', 'Marche à allure modérée et régulière, posture droite ; cardio doux et sûr, adapté à la reprise et à la récupération.'),
  ('Wall sit', 'isolation', 'legs', '{bodyweight}', '{knee}', 'Dos contre le mur, glisse jusqu''à cuisses parallèles (ou moins profond), maintiens la position en gardant le dos plaqué ; renforcement isométrique des cuisses.'),
  ('Ouverture de hanche allongé', 'mobility', 'legs', '{bodyweight}', '{}', 'Allongé sur le dos, ramène un genou puis ouvre-le sur le côté en cercles lents pour mobiliser la hanche sans forcer.')
) as v(name, category, muscle_group, equipment_required, contraindications, instructions)
where not exists (
  select 1 from public.exercises e where e.name = v.name
);
