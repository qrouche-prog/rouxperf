export default function GenerationStep({ onBack }) {
  return (
    <div>
      <h2>Ton profil est complet</h2>
      <p>
        La génération de ton programme d'entraînement par IA arrive dans une prochaine étape. Tes
        informations sont enregistrées, tu n'auras rien à ressaisir.
      </p>
      <button type="button" onClick={onBack}>
        Retour
      </button>
    </div>
  )
}
