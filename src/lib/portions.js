// Portions types pour les aliments courants : évite de partir toujours de 100 g.
// On matche sur le nom normalisé (minuscule, sans accents).

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// L'ordre compte : les libellés les plus spécifiques d'abord.
const PORTIONS = [
  { re: /\boeuf/, label: '1 œuf', g: 55 },
  { re: /\bbanane/, label: '1 banane', g: 120 },
  { re: /pomme de terre/, label: '1 pomme de terre', g: 150 },
  { re: /\bpomme\b/, label: '1 pomme', g: 150 },
  { re: /\bpoire/, label: '1 poire', g: 150 },
  { re: /\borange/, label: '1 orange', g: 150 },
  { re: /\b(clementine|mandarine)/, label: '1', g: 70 },
  { re: /\bkiwi/, label: '1 kiwi', g: 75 },
  { re: /\bpeche\b|\bnectarine/, label: '1', g: 130 },
  { re: /\babricot/, label: '1 abricot', g: 50 },
  { re: /\bfraise/, label: '1 fraise', g: 15 },
  { re: /\btomate/, label: '1 tomate', g: 120 },
  { re: /\bcarotte/, label: '1 carotte', g: 60 },
  { re: /\bconcombre/, label: '1/2 concombre', g: 150 },
  { re: /\bavocat/, label: '1 avocat', g: 200 },
  { re: /\bcourgette/, label: '1 courgette', g: 200 },
  { re: /pain de mie/, label: '1 tranche', g: 30 },
  { re: /biscotte/, label: '1 biscotte', g: 10 },
  { re: /\bbaguette/, label: '1/4 de baguette', g: 60 },
  { re: /\bpain\b/, label: '1 tranche', g: 40 },
  { re: /yaourt|yogourt/, label: '1 pot', g: 125 },
  { re: /verre de lait|\blait\b/, label: '1 verre', g: 200 },
  { re: /mozzarella/, label: '1 boule', g: 125 },
  { re: /tranche de jambon|jambon/, label: '1 tranche', g: 40 },
  { re: /blanc de poulet|filet de poulet|escalope/, label: '1 filet', g: 120 },
  { re: /steak|steack/, label: '1 steak', g: 125 },
  { re: /saucisse/, label: '1 saucisse', g: 60 },
  { re: /carre de chocolat|chocolat/, label: '1 carré', g: 10 },
  { re: /amande|noix|noisette/, label: '1 poignée', g: 30 },
]

export function guessPortion(name) {
  const n = norm(name)
  for (const p of PORTIONS) {
    if (p.re.test(n)) return { label: p.label, grams: p.g }
  }
  return null
}
