export const ONBOARDING_STEPS = [
  { slug: 'infos', label: 'Informations' },
  { slug: 'mesures', label: 'Mesures' },
  { slug: 'objectifs', label: 'Objectifs' },
  { slug: 'experience', label: 'Expérience' },
  { slug: 'preferences', label: 'Préférences' },
  { slug: 'generation', label: 'Génération' },
]

export function stepIndex(slug) {
  return ONBOARDING_STEPS.findIndex((step) => step.slug === slug)
}
