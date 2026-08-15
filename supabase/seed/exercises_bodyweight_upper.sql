-- Comble le trou de couverture du HAUT DU CORPS au poids du corps (épaules 0,
-- bras 0, pectoraux 1) et des pectoraux en haltères sans banc. Sans ces
-- exercices, l'IA ne peut pas équilibrer un programme sans matériel. Idempotent.
insert into public.exercises (name, category, muscle_group, equipment_required, contraindications, instructions)
select v.name, v.category, v.muscle_group, v.equipment_required::text[], v.contraindications::text[], v.instructions
from (values
  -- Pectoraux au poids du corps (variantes)
  ('Pompes inclinées', 'compound', 'chest', '{bodyweight}', '{shoulder,wrist}', 'Mains surélevées sur un support stable, corps gainé, descends la poitrine vers le support puis pousse ; variante plus accessible des pompes.'),
  ('Pompes déclinées', 'compound', 'chest', '{bodyweight}', '{shoulder,wrist}', 'Pieds surélevés, mains au sol, descends la poitrine puis pousse ; accentue le haut des pectoraux et les épaules.'),
  -- Épaules au poids du corps (0 auparavant)
  ('Pompes piquées', 'compound', 'shoulders', '{bodyweight}', '{shoulder,wrist}', 'En V inversé (bassin haut), fléchis les coudes pour amener la tête vers le sol puis pousse ; sollicite fortement les épaules.'),
  ('Gainage épaules au mur', 'isolation', 'shoulders', '{bodyweight}', '{shoulder,wrist}', 'Pieds en appui contre le mur (ou poirier assisté), corps gainé, maintiens la position ; renforcement isométrique des épaules.'),
  ('Élévations Y-T-W au sol', 'isolation', 'shoulders', '{bodyweight}', '{}', 'Allongé sur le ventre, décolle les bras en formant successivement les lettres Y, T puis W en serrant les omoplates ; renforce l''arrière d''épaule et la posture.'),
  -- Bras au poids du corps (0 auparavant)
  ('Pompes diamant', 'compound', 'arms', '{bodyweight}', '{shoulder,wrist}', 'Mains rapprochées en losange sous la poitrine, coudes près du corps, descends puis pousse ; cible les triceps.'),
  ('Dips sur chaise', 'compound', 'arms', '{bodyweight}', '{shoulder,wrist}', 'Mains sur le bord d''une chaise stable derrière toi, jambes devant, descends en pliant les coudes puis pousse ; cible les triceps.'),
  -- Dos au poids du corps (tire aussi les biceps, sans matériel)
  ('Tirage inversé', 'compound', 'back', '{bodyweight}', '{shoulder}', 'Allongé sous une barre basse ou une table solide, corps gainé, tire la poitrine vers la barre en serrant les omoplates puis redescends ; dos et biceps sans matériel.'),
  -- Pectoraux haltères SANS banc (comble le trou +halt)
  ('Développé haltères au sol', 'compound', 'chest', '{dumbbell}', '{shoulder}', 'Allongé au sol (sans banc), haltères au-dessus de la poitrine, descends jusqu''à ce que les coudes touchent le sol puis pousse ; alternative sans banc.'),
  ('Écarté haltères au sol', 'isolation', 'chest', '{dumbbell}', '{shoulder}', 'Allongé au sol, bras légèrement fléchis, ouvre les haltères en arc de cercle jusqu''à ce que les coudes touchent le sol puis referme en contractant les pectoraux.')
) as v(name, category, muscle_group, equipment_required, contraindications, instructions)
where not exists (
  select 1 from public.exercises e where e.name = v.name
);
