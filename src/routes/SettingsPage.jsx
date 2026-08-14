import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PersonalInfoStep from '../components/onboarding/PersonalInfoStep'
import GoalsStep from '../components/onboarding/GoalsStep'
import SportGoalsStep from '../components/onboarding/SportGoalsStep'
import ExperienceStep from '../components/onboarding/ExperienceStep'
import SpecialSituationStep from '../components/onboarding/SpecialSituationStep'
import PreferencesStep from '../components/onboarding/PreferencesStep'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'
import { ThemePicker } from '../components/theme'
import { parseActivityFile } from '../lib/activityFiles'

export default function SettingsPage() {
  const { user } = useAuth()
  const [goal, setGoal] = useState(null)
  const [trainingProfile, setTrainingProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [savedSection, setSavedSection] = useState(null)
  const [connections, setConnections] = useState([])
  const [activities, setActivities] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [wearableError, setWearableError] = useState(null)
  const [strava, setStrava] = useState(null)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [stravaMsg, setStravaMsg] = useState(null)
  const [intervals, setIntervals] = useState(null)
  const [intForm, setIntForm] = useState({ athlete_id: '', api_key: '' })
  const [intBusy, setIntBusy] = useState(false)
  const [intMsg, setIntMsg] = useState(null)

  async function loadGoal() {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setGoal(data)
  }

  async function loadTrainingProfile() {
    const { data } = await supabase.from('user_training_profile').select('*').eq('user_id', user.id).maybeSingle()
    setTrainingProfile(data)
  }

  async function loadWearables() {
    const [{ data: conns }, { data: acts }, { data: stravaConn }] = await Promise.all([
      supabase.from('terra_connections').select('provider, connected_at').eq('user_id', user.id),
      supabase
        .from('wearable_activities')
        .select('id, activity_type, started_at, duration_s, distance_m, calories, avg_hr')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(5),
      supabase.from('strava_connections').select('athlete_id, connected_at').eq('user_id', user.id).maybeSingle(),
    ])
    const { data: intervalsConn } = await supabase
      .from('intervals_connections')
      .select('athlete_id, connected_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setConnections(conns ?? [])
    setActivities(acts ?? [])
    setStrava(stravaConn ?? null)
    setIntervals(intervalsConn ?? null)
  }

  async function connectIntervals() {
    if (!intForm.athlete_id.trim() || !intForm.api_key.trim()) return
    setIntBusy(true)
    setIntMsg(null)
    const { data, error } = await supabase.functions.invoke('intervals-connect', { body: intForm })
    setIntBusy(false)
    if (error || data?.error) {
      setIntMsg(data?.error || 'Connexion impossible (vérifie athlete ID et clé API).')
      return
    }
    setIntForm({ athlete_id: '', api_key: '' })
    setIntMsg(`Connecté — ${data?.imported ?? 0} séance(s) importée(s).`)
    await loadWearables()
  }

  async function syncIntervals() {
    setIntBusy(true)
    setIntMsg(null)
    const { data, error } = await supabase.functions.invoke('intervals-sync', {})
    setIntBusy(false)
    if (error || data?.error) {
      setIntMsg('Synchronisation impossible.')
      return
    }
    setIntMsg(`${data?.imported ?? 0} séance(s) synchronisée(s).`)
    await loadWearables()
  }

  async function connectStrava() {
    setStravaBusy(true)
    setStravaMsg(null)
    const { data, error } = await supabase.functions.invoke('strava-connect', {
      body: { redirect_uri: `${window.location.origin}/settings` },
    })
    if (error || !data?.url) {
      setStravaBusy(false)
      setStravaMsg("Connexion Strava indisponible pour l'instant.")
      return
    }
    window.location.href = data.url
  }

  async function syncStrava() {
    setStravaBusy(true)
    setStravaMsg(null)
    const { data, error } = await supabase.functions.invoke('strava-sync', {})
    setStravaBusy(false)
    if (error || data?.error) {
      setStravaMsg('Synchronisation impossible.')
      return
    }
    setStravaMsg(`${data?.imported ?? 0} séance(s) synchronisée(s).`)
    await loadWearables()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setWearableError(null)
    try {
      const text = await file.text()
      const acts = parseActivityFile(text)
      if (acts.length === 0) {
        setWearableError('Fichier non reconnu. Exporte une séance au format .tcx ou .gpx.')
        return
      }
      const rows = acts.map((a) => ({
        user_id: user.id,
        source: 'file',
        provider: 'import',
        external_id: a.external_id,
        activity_type: a.activity_type,
        started_at: a.started_at,
        duration_s: a.duration_s,
        distance_m: a.distance_m,
        calories: a.calories,
        avg_hr: a.avg_hr,
        max_hr: a.max_hr,
        elevation_gain_m: a.elevation_gain_m,
      }))
      const { error } = await supabase.from('wearable_activities').upsert(rows, { onConflict: 'user_id,external_id' })
      if (error) {
        setWearableError(error.message)
        return
      }
      await loadWearables()
    } catch (err) {
      setWearableError(err.message || 'Import impossible')
    } finally {
      setImporting(false)
    }
  }

  async function connectWearable() {
    setConnecting(true)
    setWearableError(null)
    const { data, error } = await supabase.functions.invoke('terra-connect', {
      body: { redirect_url: `${window.location.origin}/settings` },
    })
    if (error || !data?.url) {
      setConnecting(false)
      setWearableError("Connexion indisponible pour l'instant.")
      return
    }
    window.location.href = data.url
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadGoal(), loadTrainingProfile(), loadWearables()])
      setStatus('idle')
    }
    load()
  }, [user.id])

  // Retour de l'autorisation Strava (?code=…) : on échange le code puis on
  // nettoie l'URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const err = params.get('error')
    if (err) {
      setStravaMsg('Autorisation Strava refusée.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (!code) return
    const scope = params.get('scope') || ''
    window.history.replaceState({}, '', window.location.pathname)
    setStravaBusy(true)
    ;(async () => {
      const { data, error } = await supabase.functions.invoke('strava-exchange', { body: { code, scope } })
      setStravaBusy(false)
      if (error || data?.error) {
        setStravaMsg('Connexion Strava échouée.')
        return
      }
      setStravaMsg(`Strava connecté — ${data?.imported ?? 0} séance(s) importée(s).`)
      await loadWearables()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function flashSaved(section) {
    setSavedSection(section)
    setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2500)
  }

  if (status === 'loading') return null

  return (
    <main>
      <TopNav />
      <h1>Réglages</h1>
      <p>
        Modifie tes informations, ton objectif et tes préférences à tout moment — ça n'affecte pas ton programme
        déjà généré, seules les prochaines générations en tiendront compte.
      </p>

      <section id="apparence" className="card settings-section">
        <h2>Apparence</h2>
        <ThemePicker />
      </section>

      <section id="objets" className="card settings-section">
        <h2>Objets connectés</h2>
        <p className="settings-hint">
          Connecte <strong>intervals.icu</strong> (gratuit) pour importer automatiquement tes séances. Garmin,
          Strava, etc. s'y synchronisent tout seuls.
        </p>

        <div className="strava-block">
          {intervals ? (
            <>
              <p className="wearable-status">✓ intervals.icu connecté</p>
              <button type="button" className="btn-primary" onClick={syncIntervals} disabled={intBusy}>
                {intBusy ? 'Synchronisation…' : 'Synchroniser'}
              </button>
            </>
          ) : (
            <div className="intervals-form">
              <label>
                <span>Athlete ID</span>
                <input
                  type="text"
                  value={intForm.athlete_id}
                  onChange={(e) => setIntForm((f) => ({ ...f, athlete_id: e.target.value }))}
                  placeholder="ex. i123456"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Clé API</span>
                <input
                  type="password"
                  value={intForm.api_key}
                  onChange={(e) => setIntForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder="clé API intervals.icu"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                onClick={connectIntervals}
                disabled={intBusy || !intForm.athlete_id.trim() || !intForm.api_key.trim()}
              >
                {intBusy ? 'Connexion…' : 'Connecter intervals.icu'}
              </button>
            </div>
          )}
          {intMsg && <p className="eyebrow">{intMsg}</p>}
          <p className="nutrition-disclaimer">
            Ton <strong>Athlete ID</strong> et ta <strong>clé API</strong> sont sur intervals.icu → Settings →
            Developer. (Garmin doit être lié à ton compte intervals.icu.)
          </p>
        </div>

        <p className="settings-hint wearable-or">Ou importer manuellement un fichier de séance :</p>

        <label className={`btn-secondary photo-btn${importing ? ' photo-btn-loading' : ''}`}>
          {importing ? 'Import…' : '⬆ Importer une séance (.tcx / .gpx)'}
          {/* Pas d'attribut accept : iOS grise les .tcx/.gpx (type inconnu) et
              empêche de les sélectionner. Le parseur valide le contenu. */}
          <input type="file" onChange={handleImportFile} disabled={importing} hidden />
        </label>
        <p className="nutrition-disclaimer">
          Depuis Garmin Connect (site web) : ouvre une activité → ⚙ → « Exporter en TCX » (ou GPX), puis importe
          le fichier ici.
        </p>

        <details className="wearable-auto">
          <summary>Autres méthodes (avancé)</summary>
          <p className="settings-hint">
            <strong>Strava</strong> : import auto, mais l'API Strava nécessite désormais un abonnement Strava payant.
            <strong> Terra</strong> : agrégateur multi-montres, payant (~500 $/mois).
          </p>
          {strava ? (
            <button type="button" className="btn-secondary" onClick={syncStrava} disabled={stravaBusy}>
              {stravaBusy ? 'Synchronisation…' : 'Synchroniser Strava'}
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={connectStrava} disabled={stravaBusy}>
              {stravaBusy ? 'Ouverture…' : 'Connecter Strava (abonnement requis)'}
            </button>
          )}
          {stravaMsg && <p className="eyebrow">{stravaMsg}</p>}
          {connections.length > 0 && (
            <p className="wearable-status">✓ Terra : {connections.map((c) => c.provider || 'appareil').join(', ')}</p>
          )}
          <button type="button" className="btn-secondary wearable-terra-btn" onClick={connectWearable} disabled={connecting}>
            {connecting ? 'Ouverture…' : 'Connecter via Terra'}
          </button>
        </details>

        {wearableError && <p role="alert">{wearableError}</p>}

        {activities.length > 0 && (
          <>
            <p className="eyebrow wearable-list-title">Dernières séances synchronisées</p>
            <ul className="wearable-list">
              {activities.map((a) => (
                <li key={a.id} className="wearable-item">
                  <span className="wearable-item-info">
                    <strong>{a.activity_type}</strong>
                    <span className="eyebrow">
                      {a.started_at ? new Date(a.started_at).toLocaleDateString('fr-CH') : ''}
                      {a.duration_s ? ` · ${Math.round(a.duration_s / 60)} min` : ''}
                      {a.distance_m ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : ''}
                      {a.avg_hr ? ` · ${a.avg_hr} bpm` : ''}
                      {a.calories ? ` · ${Math.round(a.calories)} kcal` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section id="infos" className="card settings-section">
        <PersonalInfoStep submitLabel="Enregistrer" onNext={() => flashSaved('infos')} />
        {savedSection === 'infos' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="objectif" className="card settings-section">
        <GoalsStep
          initial={goal ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadGoal()
            flashSaved('objectif')
          }}
        />
        {savedSection === 'objectif' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="sport" className="card settings-section">
        <SportGoalsStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('sport')
          }}
        />
        {savedSection === 'sport' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="experience" className="card settings-section">
        <ExperienceStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('experience')
          }}
        />
        {savedSection === 'experience' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="situation" className="card settings-section">
        <SpecialSituationStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('situation')
          }}
        />
        {savedSection === 'situation' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <section id="preferences" className="card settings-section">
        <PreferencesStep
          initial={trainingProfile ?? undefined}
          submitLabel="Enregistrer"
          onNext={async () => {
            await loadTrainingProfile()
            flashSaved('preferences')
          }}
        />
        {savedSection === 'preferences' && <p className="settings-saved">Enregistré ✓</p>}
      </section>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
