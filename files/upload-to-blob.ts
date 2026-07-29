/**
 * Bascule les médias de public/ vers Vercel Blob et réécrit data/exercises.json.
 *
 * À lancer UNIQUEMENT si public/exercises/ devient gênant (≈18 Mo actuellement,
 * ce qui reste acceptable dans le dépôt). Tant que ça tient, garde les fichiers
 * en local : moins de pièces mobiles, et le build Next optimise déjà le service.
 *
 * Prérequis : npm i @vercel/blob   +   BLOB_READ_WRITE_TOKEN dans .env.local
 * Usage     : npx tsx scripts/upload-to-blob.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { put } from '@vercel/blob';

import type { Exercise } from '../lib/exercises/types.ts';

const SRC = 'public/exercises';
const DATA = 'data/exercises.json';

const CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN manquant. Ajoute-le dans .env.local.');
  }

  const files = readdirSync(SRC);
  const urlByName = new Map<string, string>();

  console.log(`→ envoi de ${files.length} fichiers…`);

  // Séquentiel volontairement : Vercel Blob limite le débit, et un échec au
  // milieu d'un Promise.all laisse un état à moitié migré difficile à reprendre.
  for (const [i, file] of files.entries()) {
    const ext = file.slice(file.lastIndexOf('.'));
    const blob = await put(`exercises/${file}`, readFileSync(join(SRC, file)), {
      access: 'public',
      contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
      addRandomSuffix: false,
      // Les illustrations ne changent jamais : cache long.
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    urlByName.set(file, blob.url);

    if ((i + 1) % 25 === 0) console.log(`   ${i + 1}/${files.length}`);
  }

  // Réécriture des chemins. Le slug ne bouge pas : seule la colonne média change.
  const exercises: Exercise[] = JSON.parse(readFileSync(DATA, 'utf8'));
  let rewritten = 0;

  for (const ex of exercises) {
    if (!ex.media) continue;
    ex.media.frames = ex.media.frames.map((f) => {
      const url = urlByName.get(basename(f));
      if (url) rewritten++;
      return url ?? f;
    });
  }

  writeFileSync(DATA, JSON.stringify(exercises, null, 2), 'utf8');
  console.log(`✓ ${rewritten} chemins réécrits vers Vercel Blob`);
  console.log('  public/exercises/ peut maintenant être supprimé du dépôt.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
