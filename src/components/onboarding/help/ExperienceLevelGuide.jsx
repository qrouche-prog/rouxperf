import HelpBubble from './HelpBubble'

const LEVELS = [
  [
    'Débutant',
    "0 à 6 mois d'entraînement régulier, ou reprise après une longue pause. Les mouvements de base (squat, développé, tirage) ne sont pas encore maîtrisés techniquement.",
  ],
  [
    'Intermédiaire',
    'Environ 6 mois à 2 ans de pratique régulière. Technique correcte sur les mouvements de base, la progression reste régulière mais commence à ralentir.',
  ],
  [
    'Avancé',
    'Plus de 2 ans de pratique régulière et structurée. Technique maîtrisée, la progression demande une programmation plus fine (périodisation, gestion de la fatigue).',
  ],
]

export default function ExperienceLevelGuide() {
  return (
    <HelpBubble label="niveau d'expérience">
      <div className="experience-level-guide">
        <ul>
          {LEVELS.map(([level, desc]) => (
            <li key={level}>
              <strong>{level}</strong> — {desc}
            </li>
          ))}
        </ul>
        <p className="help-tip">
          En cas de doute entre deux niveaux, choisis le plus bas : le programme s'adaptera
          progressivement au fil des séances.
        </p>
      </div>
    </HelpBubble>
  )
}
