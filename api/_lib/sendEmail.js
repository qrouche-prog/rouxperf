export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    // Pas configuré : on n'échoue pas la requête appelante pour autant,
    // l'admin verra quand même la demande dans /admin.
    console.warn('RESEND_API_KEY ou RESEND_FROM_EMAIL manquant — email non envoyé.')
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error(`Échec envoi email Resend (${response.status}): ${body}`)
  }
}
