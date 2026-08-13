// Génère src/data/ciqual.json depuis la table CIQUAL 2020 (ANSES).
// Source (Licence Ouverte Etalab 2.0, gratuite) :
//   https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls
// Usage : télécharger le .xls puis
//   node scripts/build-ciqual.mjs <chemin-vers-ciqual.xls>
// (défaut : .cache/ciqual.xls)
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const COL = { name: 7, kcal: 10, proteinJones: 14, protein625: 15, carbs: 16, fat: 17 }

function num(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  let s = String(v).trim()
  if (!s || s === '-') return null
  if (/^traces$/i.test(s)) return 0
  s = s.replace('<', '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const round1 = (n) => (n == null ? 0 : Math.round(n * 10) / 10)

const src = process.argv[2] || '.cache/ciqual.xls'
const wb = XLSX.read(readFileSync(src), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

const out = []
for (let i = 1; i < rows.length; i += 1) {
  const r = rows[i]
  if (!r) continue
  const name = r[COL.name] ? String(r[COL.name]).trim() : ''
  const kcal = num(r[COL.kcal])
  if (!name || kcal == null) continue
  const protein = num(r[COL.proteinJones]) ?? num(r[COL.protein625])
  out.push({
    name,
    kcal: Math.round(kcal),
    protein_g: round1(protein),
    carbs_g: round1(num(r[COL.carbs])),
    fat_g: round1(num(r[COL.fat])),
  })
}

writeFileSync('src/data/ciqual.json', JSON.stringify(out))
console.log(`CIQUAL : ${out.length} aliments écrits dans src/data/ciqual.json`)
