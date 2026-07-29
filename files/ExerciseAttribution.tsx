import type { ExerciseMedia } from '@/lib/exercises/types';

/**
 * Crédit obligatoire pour les illustrations sous CC BY-SA 3.0.
 *
 * Ce n'est pas décoratif : sans ce crédit, l'usage des images est en infraction.
 * Le composant doit apparaître partout où une illustration est affichée, ou à
 * défaut sur une page /credits liée depuis chaque fiche.
 */
export function ExerciseAttribution({ media }: { media: ExerciseMedia | null }) {
  if (!media || media.provider === 'rouxperf') return null;

  return (
    <p className="text-xs leading-relaxed text-neutral-500">
      {media.attribution}{' '}
      <a
        href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr"
        target="_blank"
        rel="noreferrer license"
        className="underline underline-offset-2 hover:text-neutral-300"
      >
        Détail de la licence
      </a>
    </p>
  );
}
