/**
 * rouxperf — génération des icônes PWA et du favicon
 *
 *     npm run build:icons
 *
 * Source unique de la géométrie : le losange + X de src/components/Logo.jsx.
 * Les couleurs sont figées ici (un PNG et un favicon SVG n'héritent d'aucune
 * variable CSS) — si --roux-500 ou --roux-50 changent dans
 * src/rouxperf-theme.css, il faut les reporter ci-dessous et relancer.
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const BG = '#0A0A0A' // noir
const MARK = '#C4552B' // --roux-500

/**
 * La marque est dessinée dans un carré 32×32, puis mise à l'échelle et centrée.
 * `coverage` = part du côté du canvas qu'elle occupe.
 */
function markSvg(size, coverage) {
  const span = size * coverage
  const offset = (size - span) / 2
  const scale = span / 32

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${MARK}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M16 2 L30 16 L16 30 L2 16 Z" stroke-width="1.8"/>
    <path d="M12.5 12.5 L19.5 19.5 M19.5 12.5 L12.5 19.5" stroke-width="3.2"/>
  </g>
</svg>`
}

const TARGETS = [
  /* Android et navigateurs, purpose "any" : l'icône est affichée telle quelle,
     on garde une marge confortable plutôt que le bord-à-bord d'avant. */
  { file: 'public/icons/icon-192.png', size: 192, coverage: 0.76 },
  { file: 'public/icons/icon-512.png', size: 512, coverage: 0.76 },

  /* purpose "maskable" : le système découpe une forme quelconque (cercle,
     goutte, squircle) et ne garantit que les 80 % centraux. Les pointes du
     losange touchent le bord de sa boîte — à 62 % elles restent bien dans le
     cercle de sûreté. Fichier distinct : réutiliser l'icône "any" en maskable
     (ce que faisait le manifeste) fait rogner les pointes. */
  { file: 'public/icons/icon-maskable-512.png', size: 512, coverage: 0.62 },

  /* iOS applique son propre masque en superellipse et ignore la transparence :
     fond plein obligatoire. Le masque ne mord que les coins, or les pointes du
     losange visent le milieu des côtés — 72 % passe sans risque. */
  { file: 'public/icons/apple-touch-icon.png', size: 180, coverage: 0.72 },
  { file: 'public/icons/apple-touch-icon-167.png', size: 167, coverage: 0.72 },
  { file: 'public/icons/apple-touch-icon-152.png', size: 152, coverage: 0.72 },
  { file: 'public/icons/apple-touch-icon-120.png', size: 120, coverage: 0.72 },
]

for (const { file, size, coverage } of TARGETS) {
  const png = await sharp(Buffer.from(markSvg(size, coverage)))
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(join(ROOT, file), png)
  console.log(`${file}  ${size}×${size}  marque ${Math.round(coverage * 100)} %`)
}

/* Le favicon reste vectoriel : même géométrie, sans rastérisation. */
const favicon = markSvg(32, 0.84).replace(
  '<svg xmlns',
  '<!-- Généré par scripts/build-icons.mjs — ne pas éditer à la main -->\n<svg xmlns',
)
await writeFile(join(ROOT, 'public/favicon.svg'), `${favicon}\n`)
console.log('public/favicon.svg')
