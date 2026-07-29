/**
 * Construit la bibliothèque d'exercices rouxperf à partir de deux sources libres.
 *
 *   Médias      : chaosbastler/opentraining-exercises  (SVG, CC BY-SA 3.0, Everkinetic)
 *   Métadonnées : yuhonas/free-exercise-db              (JSON, domaine public revendiqué)
 *
 * Sortie :
 *   public/exercises/*.svg   SVG normalisés, recolorisables via `currentColor`
 *   data/exercises.json      bibliothèque fusionnée
 *   data/_review.csv         rapprochements douteux à valider à la main
 *
 * Usage : npx tsx scripts/build-exercise-library.ts
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

import {
  CATEGORY_EN_FR,
  EQUIPMENT_DE_FR,
  EQUIPMENT_EN_FR,
  FORCE_EN_FR,
  LEVEL_EN_FR,
  MECHANIC_EN_FR,
  MUSCLE_DE_FR,
  MUSCLE_EN_FR,
  translate,
} from '../lib/exercises/dictionaries.ts';
import type { BuildReport, Exercise, ExerciseMedia } from '../lib/exercises/types.ts';

const OT_REPO = 'https://github.com/chaosbastler/opentraining-exercises.git';
const FEDB_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const TMP = '.cache/opentraining';
const OUT_SVG = 'public/exercises';
const OUT_DATA = 'data';

const ATTRIBUTION =
  'Illustrations : Everkinetic — CC BY-SA 3.0, via le projet OpenTraining';

/** Seuil au-dessus duquel un rapprochement est accepté sans relecture. */
const MATCH_THRESHOLD = 0.82;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Bigrammes pour le coefficient de Dice. */
function bigrams(s: string): Set<string> {
  const t = s.replace(/[^a-z0-9]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Similarité 0–1. Dice sur bigrammes, robuste aux inversions de mots. */
function similarity(a: string, b: string): number {
  const A = bigrams(a.toLowerCase());
  const B = bigrams(b.toLowerCase());
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/**
 * Retire le suffixe de pose d'un nom de fichier.
 * "Bench-press-1.png" -> { base: "Bench-press", pose: 1 }
 * "Squats-2-1.png"    -> { base: "Squats-2",    pose: 1 }   (variante 2, pose 1)
 */
function splitPose(file: string): { base: string; pose: number } {
  const stem = basename(file, extname(file));
  const m = stem.match(/^(.*)-(\d+)$/);
  if (!m) return { base: stem, pose: 1 };
  return { base: m[1], pose: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// Étape 1 — récupération des sources
// ---------------------------------------------------------------------------

function fetchSources(): void {
  if (!existsSync(TMP)) {
    mkdirSync('.cache', { recursive: true });
    console.log('→ clone opentraining-exercises…');
    execSync(`git clone --depth 1 ${OT_REPO} ${TMP}`, { stdio: 'inherit' });
  } else {
    console.log('→ opentraining déjà en cache');
  }
}

async function fetchFedb(): Promise<any[]> {
  console.log('→ téléchargement free-exercise-db…');
  const res = await fetch(FEDB_URL);
  if (!res.ok) throw new Error(`free-exercise-db: HTTP ${res.status}`);
  return res.json() as Promise<any[]>;
}

// ---------------------------------------------------------------------------
// Étape 2 — parsing des XML OpenTraining
// ---------------------------------------------------------------------------

interface OtExercise {
  nameDe: string;
  nameEn: string | null;
  musclesDe: string[];
  equipmentDe: string[];
  imageFiles: string[];
  dir: string;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function parseOpenTraining(): OtExercise[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
  const out: OtExercise[] = [];

  // Les XML de la racine portent muscles + matériel.
  // Ceux de still_unsorted n'ont que le nom et les images : on les garde quand
  // même, free-exercise-db fournira les métadonnées manquantes.
  for (const dir of ['', 'still_unsorted']) {
    const abs = join(TMP, dir);
    if (!existsSync(abs)) continue;

    for (const file of readdirSync(abs).filter((f) => f.endsWith('.xml'))) {
      const raw = readFileSync(join(abs, file), 'utf8');
      let doc: any;
      try {
        doc = parser.parse(raw);
      } catch {
        console.warn(`  ! XML illisible, ignoré : ${file}`);
        continue;
      }

      const node = doc?.ExerciseType;
      if (!node) continue;

      const locales = asArray(node.Locale);
      const en = locales.find((l: any) => l['@language'] === 'en')?.['@name'] ?? null;

      out.push({
        nameDe: String(node['@name'] ?? basename(file, '.xml')),
        nameEn: en,
        musclesDe: asArray(node.Muscle).map((m: any) => String(m['@name'])),
        equipmentDe: asArray(node.SportsEquipment).map((e: any) => String(e['@name'])),
        imageFiles: asArray(node.Image).map((i: any) => String(i['@path'])),
        dir,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Étape 3 — normalisation SVG
// ---------------------------------------------------------------------------

/**
 * Les SVG d'origine sortent d'Inkscape : métadonnées RDF, namespaces sodipodi,
 * pas de viewBox, et un `fill:#000000` en dur.
 *
 * On produit un SVG qui hérite de la couleur du texte parent, ce qui permet de
 * l'afficher aux couleurs rouxperf par une simple classe Tailwind.
 */
function normalizeSvg(source: string): { svg: string; hasEmbeddedRaster: boolean } {
  let svg = source;

  const hasEmbeddedRaster = /base64/i.test(svg);

  // viewBox depuis width/height, sinon le SVG ne se redimensionne pas.
  if (!/viewBox=/.test(svg)) {
    const w = svg.match(/\swidth="([\d.]+)"/)?.[1];
    const h = svg.match(/\sheight="([\d.]+)"/)?.[1];
    if (w && h) svg = svg.replace(/<svg\b/, `<svg viewBox="0 0 ${w} ${h}"`);
  }

  // Dimensions fixes retirées : c'est le conteneur qui décide.
  svg = svg.replace(/\s(width|height)="[\d.]+(px)?"/g, '');

  // Bloc metadata RDF : lourd et inutile au runtime.
  // La licence n'est PAS perdue pour autant, elle est portée par le champ
  // `attribution` de la fiche et affichée dans l'UI (obligation CC BY-SA).
  svg = svg.replace(/<metadata[\s\S]*?<\/metadata>/g, '');
  // namedview peut être auto-fermant OU contenir des enfants (inkscape:grid…).
  // On retire d'abord la forme appariée : sinon la lazy-match s'arrête au premier
  // "/>" interne et laisse un </sodipodi:namedview> orphelin qui casse le XML
  // une fois le namespace sodipodi supprimé plus bas.
  svg = svg.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/g, '');
  svg = svg.replace(/<sodipodi:namedview[\s\S]*?\/>/g, '');
  // Autres éléments namespacés inkscape/sodipodi (ex. inkscape:perspective),
  // appariés ou auto-fermants, dont le namespace sera lui aussi retiré.
  svg = svg.replace(/<(inkscape|sodipodi):([\w-]+)[\s\S]*?<\/\1:\2>/g, '');
  svg = svg.replace(/<(inkscape|sodipodi):[\w-]+[\s\S]*?\/>/g, '');
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  svg = svg.replace(/\s(inkscape|sodipodi):[\w-]+="[^"]*"/g, '');
  svg = svg.replace(/\sxmlns:(inkscape|sodipodi|dc|cc|rdf)="[^"]*"/g, '');

  // Le trait devient héritable. On ne touche pas aux dégradés (stop-color).
  svg = svg.replace(/fill:#000000/g, 'fill:currentColor');
  svg = svg.replace(/fill="#000000"/g, 'fill="currentColor"');

  svg = svg.replace(/\n\s*\n/g, '\n').trim();
  return { svg, hasEmbeddedRaster };
}

/** Copie et normalise les SVG d'un exercice. Renvoie les chemins publics. */
function emitMedia(ot: OtExercise, slug: string): ExerciseMedia | null {
  // Regroupe les fichiers par variante, puis trie par numéro de pose.
  const byBase = new Map<string, { pose: number; file: string }[]>();
  for (const f of ot.imageFiles) {
    const { base, pose } = splitPose(f);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push({ pose, file: f });
  }

  // On ne garde que la première variante : deux poses suffisent à la boucle,
  // et mélanger des variantes dans une même animation donne un rendu incohérent.
  const first = [...byBase.values()][0];
  if (!first) return null;
  first.sort((a, b) => a.pose - b.pose);

  const frames: string[] = [];
  let embedded = false;

  for (const { file } of first) {
    const stem = basename(file, extname(file));
    const svgPath = join(TMP, 'svg', `${stem}.svg`);

    if (existsSync(svgPath)) {
      // Cas favorable : vectoriel, recolorisable via currentColor.
      const { svg, hasEmbeddedRaster } = normalizeSvg(readFileSync(svgPath, 'utf8'));
      embedded ||= hasEmbeddedRaster;

      const outName = `${slug}-${frames.length + 1}.svg`;
      writeFileSync(join(OUT_SVG, outName), svg, 'utf8');
      frames.push(`/exercises/${outName}`);
      continue;
    }

    // Repli : le dossier svg/ ne couvre que la racine du dépôt. Pour les ~180
    // exercices de still_unsorted, on récupère le PNG/GIF d'origine. Non
    // recolorisable, mais c'est 3× plus d'exercices illustrés.
    const rasterPath = [join(TMP, ot.dir, file), join(TMP, file)].find((p) => existsSync(p));
    if (!rasterPath) continue;

    const outName = `${slug}-${frames.length + 1}${extname(file)}`;
    writeFileSync(join(OUT_SVG, outName), readFileSync(rasterPath));
    frames.push(`/exercises/${outName}`);
  }

  if (!frames.length) return null;

  return {
    provider: 'opentraining',
    frames,
    attribution: ATTRIBUTION,
    license: 'CC-BY-SA-3.0',
    ...(embedded ? { hasEmbeddedRaster: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Étape 4 — rapprochement et fusion
// ---------------------------------------------------------------------------

function build(otAll: OtExercise[], fedb: any[]): { exercises: Exercise[]; report: BuildReport } {
  const missing = new Set<string>();
  const exercises: Exercise[] = [];
  const review: string[] = ['slug,nom_opentraining,candidat_fedb,confiance'];

  const usedSlugs = new Set<string>();
  let withMedia = 0;
  let high = 0;
  let low = 0;

  for (const ot of otAll) {
    const label = ot.nameEn ?? ot.nameDe;

    // Meilleur candidat dans free-exercise-db.
    let best: any = null;
    let bestScore = 0;
    for (const cand of fedb) {
      const score = similarity(label, cand.name);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    const matched = bestScore >= MATCH_THRESHOLD ? best : null;
    if (matched) high++;
    else if (best && bestScore >= 0.6) {
      low++;
      review.push(`${slugify(label)},"${label}","${best.name}",${bestScore.toFixed(2)}`);
    }

    // Slug stable, dédoublonné.
    let slug = slugify(label);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(label)}-${n++}`;
    usedSlugs.add(slug);

    const media = emitMedia(ot, slug);
    if (media) withMedia++;

    // Les muscles OpenTraining priment (ils décrivent l'illustration montrée),
    // free-exercise-db complète.
    const primary = ot.musclesDe.length
      ? ot.musclesDe.map((m) => translate(m, MUSCLE_DE_FR, missing))
      : (matched?.primaryMuscles ?? []).map((m: string) => translate(m, MUSCLE_EN_FR, missing));

    const equipment = ot.equipmentDe.length
      ? ot.equipmentDe.map((e) => translate(e, EQUIPMENT_DE_FR, missing))
      : matched?.equipment
        ? [translate(matched.equipment, EQUIPMENT_EN_FR, missing)]
        : [];

    exercises.push({
      slug,
      // Le nom français reste à écrire : c'est ta voix éditoriale, pas une
      // traduction automatique. On amorce avec l'anglais.
      nameFr: label,
      nameEn: ot.nameEn,
      primaryMuscles: primary,
      secondaryMuscles: (matched?.secondaryMuscles ?? []).map((m: string) =>
        translate(m, MUSCLE_EN_FR, missing),
      ),
      equipment,
      category: matched ? translate(matched.category, CATEGORY_EN_FR, missing) : null,
      level: matched ? translate(matched.level, LEVEL_EN_FR, missing) : null,
      force: matched?.force ? translate(matched.force, FORCE_EN_FR, missing) : null,
      mechanic: matched?.mechanic ? translate(matched.mechanic, MECHANIC_EN_FR, missing) : null,
      instructionsFr: [],
      instructionsEn: matched?.instructions ?? [],
      media,
      matchConfidence: matched ? Number(bestScore.toFixed(2)) : 0,
      reviewed: false,
    });
  }

  writeFileSync(join(OUT_DATA, '_review.csv'), review.join('\n'), 'utf8');

  return {
    exercises: exercises.sort((a, b) => a.slug.localeCompare(b.slug)),
    report: {
      totalOpenTraining: otAll.length,
      totalFedb: fedb.length,
      withMedia,
      matchedHighConfidence: high,
      matchedLowConfidence: low,
      mediaOnly: otAll.length - high,
      missingTranslations: [...missing].sort(),
    },
  };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  rmSync(OUT_SVG, { recursive: true, force: true });
  mkdirSync(OUT_SVG, { recursive: true });
  mkdirSync(OUT_DATA, { recursive: true });

  fetchSources();
  const fedb = await fetchFedb();
  const ot = parseOpenTraining();

  const { exercises, report } = build(ot, fedb);

  writeFileSync(join(OUT_DATA, 'exercises.json'), JSON.stringify(exercises, null, 2), 'utf8');

  console.log('\n─── Bibliothèque construite ───');
  console.log(`Exercices OpenTraining   ${report.totalOpenTraining}`);
  console.log(`Fiches free-exercise-db  ${report.totalFedb}`);
  console.log(`Avec illustration SVG    ${report.withMedia}`);
  console.log(`Rapprochés (confiance ≥ ${MATCH_THRESHOLD})  ${report.matchedHighConfidence}`);
  console.log(`À valider à la main      ${report.matchedLowConfidence}  → data/_review.csv`);

  if (report.missingTranslations.length) {
    console.warn('\n⚠ Termes sans traduction française :');
    for (const t of report.missingTranslations) console.warn(`   ${t}`);
    console.warn('  → complète lib/exercises/dictionaries.ts puis relance.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
