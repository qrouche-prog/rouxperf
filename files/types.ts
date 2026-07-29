/** Provenance d'un média — déterminant pour la conformité de licence. */
export type MediaProvider = 'opentraining' | 'fedb' | 'rouxperf';

export interface ExerciseMedia {
  provider: MediaProvider;
  /** Chemin servi par notre propre domaine, jamais l'URL d'origine. */
  frames: string[];
  /** Texte de crédit à afficher. Vide uniquement si provider === 'rouxperf'. */
  attribution: string;
  license: 'CC-BY-SA-3.0' | 'public-domain' | 'proprietary';
  /** true si le SVG contient un raster encodé en base64 (non recolorisable). */
  hasEmbeddedRaster?: boolean;
}

export interface Exercise {
  /** Identifiant stable. Ne change JAMAIS, même si le média change. */
  slug: string;
  nameFr: string;
  nameEn: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  category: string | null;
  level: string | null;
  force: string | null;
  mechanic: string | null;
  /** Instructions en français. Vide si non traduites : à toi de les écrire. */
  instructionsFr: string[];
  /** Instructions sources en anglais, conservées pour la traduction. */
  instructionsEn: string[];
  media: ExerciseMedia | null;
  /** Confiance du rapprochement OpenTraining ↔ free-exercise-db (0–1). */
  matchConfidence: number;
  /** true si un humain a validé la fiche. Passe à true à la main. */
  reviewed: boolean;
}

export interface BuildReport {
  totalOpenTraining: number;
  totalFedb: number;
  withMedia: number;
  matchedHighConfidence: number;
  matchedLowConfidence: number;
  mediaOnly: number;
  missingTranslations: string[];
}
