import HelpBubble from './HelpBubble'

const BODY_FAT_RANGES = {
  male: [
    ['3–5 %', 'Niveau essentiel / compétition : striations visibles partout, veines très marquées.'],
    ['6–9 %', 'Athlète : abdominaux et veines nettement visibles.'],
    ['10–14 %', 'Sportif : abdominaux visibles, silhouette bien définie.'],
    ['15–19 %', 'En forme : contours musculaires visibles, un peu de graisse sur le ventre.'],
    ['20–24 %', 'Moyenne : ventre légèrement marqué, muscles peu visibles.'],
    ['25 % et +', 'Surcharge : ventre proéminent.'],
  ],
  female: [
    ['10–13 %', 'Niveau essentiel / compétition : très peu de graisse visible.'],
    ['14–17 %', 'Athlète : définition musculaire nette.'],
    ['18–22 %', 'Sportive : silhouette tonique et définie.'],
    ['23–27 %', 'Moyenne : silhouette normale, courbes présentes.'],
    ['28–32 %', 'Un peu de surcharge : ventre et hanches marqués.'],
    ['33 % et +', 'Surcharge : silhouette plus ronde.'],
  ],
}

export default function BodyFatGuide() {
  return (
    <HelpBubble label="taux de masse grasse">
      <div className="body-fat-guide">
        <p>Plusieurs façons d'estimer ton taux de masse grasse :</p>
        <ul>
          <li>
            <strong>Pince à plis cutanés</strong> — la plus précise si tu sais t'en servir, mesure
            plusieurs plis (abdomen, triceps, cuisse...).
          </li>
          <li>
            <strong>Balance à impédancemétrie</strong> — pratique pour suivre une tendance, mais
            varie selon l'hydratation du moment.
          </li>
          <li>
            <strong>Estimation visuelle</strong> — compare-toi aux repères ci-dessous.
          </li>
        </ul>
        <p className="help-tip">Tu ne sais pas ? Laisse le champ vide, ce n'est pas obligatoire.</p>

        <h4>Repères visuels — hommes</h4>
        <table>
          <tbody>
            {BODY_FAT_RANGES.male.map(([range, desc]) => (
              <tr key={range}>
                <td>{range}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Repères visuels — femmes</h4>
        <table>
          <tbody>
            {BODY_FAT_RANGES.female.map(([range, desc]) => (
              <tr key={range}>
                <td>{range}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HelpBubble>
  )
}
