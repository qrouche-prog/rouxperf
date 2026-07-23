export const ONBOARDING_STEPS = [
  { slug: 'infos', label: 'Informations' },
  { slug: 'mesures', label: 'Mesures' },
  { slug: 'objectifs', label: 'Objectifs' },
  { slug: 'sport', label: 'Objectifs sportifs' },
  { slug: 'experience', label: 'Expérience' },
  { slug: 'situation', label: 'Ta situation' },
  { slug: 'preferences', label: 'Préférences' },
  { slug: 'generation', label: 'Génération' },
]

export function stepIndex(slug) {
  return ONBOARDING_STEPS.findIndex((step) => step.slug === slug)
}
