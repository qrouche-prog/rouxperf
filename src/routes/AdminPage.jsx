import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TopNav from '../components/TopNav'
import BottomNav from '../components/BottomNav'

async function authedFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? `Erreur ${response.status}`)
  }
  return body
}

function blankExercise(exercisesList) {
  return { exercise_id: exercisesList[0]?.id ?? '', sets: 3, reps: '8-12', rest_seconds: 60, notes: '' }
}

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [exercisesList, setExercisesList] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const [selectedUser, setSelectedUser] = useState(null)
  const [program, setProgram] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [weekIndex, setWeekIndex] = useState(0)
  const [programStatus, setProgramStatus] = useState('idle')
  const [programError, setProgramError] = useState(null)
  const [saved, setSaved] = useState(false)

  const [pendingRequests, setPendingRequests] = useState([])
  const [approvingId, setApprovingId] = useState(null)
  const [approveError, setApproveError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [usersBody, { data: exercises }] = await Promise.all([
          authedFetch('/api/admin/users'),
          supabase.from('exercises').select('id, name, category').order('name'),
        ])
        setUsers(usersBody.users)
        setExercisesList(exercises ?? [])
      } catch (err) {
        setError(err.message)
      }
      setStatus('idle')
    }
    load()
    loadPendingRequests()
  }, [])

  async function loadPendingRequests() {
    try {
      const body = await authedFetch('/api/admin/pending-generations')
      setPendingRequests(body.requests)
    } catch (err) {
      setApproveError(err.message)
    }
  }

  async function handleApprove(programId) {
    setApproveError(null)
    setApprovingId(programId)
    try {
      await authedFetch('/api/admin/approve-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId }),
      })
      setPendingRequests((current) => current.filter((r) => r.program_id !== programId))
    } catch (err) {
      setApproveError(err.message)
    }
    setApprovingId(null)
  }

  async function openUser(user) {
    setSelectedUser(user)
    setProgram(null)
    setWeeks([])
    setWeekIndex(0)
    setProgramError(null)
    setSaved(false)
    setProgramStatus('loading')

    try {
      const body = await authedFetch(`/api/admin/program?user_id=${user.id}`)
      setProgram(body.program)
      setWeeks(body.program?.structure?.weeks ?? [])
    } catch (err) {
      setProgramError(err.message)
    }
    setProgramStatus('idle')
  }

  function updateDay(dIdx, patch) {
    setWeeks((current) =>
      current.map((week, wIdx) =>
        wIdx !== weekIndex
          ? week
          : { ...week, days: week.days.map((day, i) => (i === dIdx ? { ...day, ...patch } : day)) }
      )
    )
  }

  function updateExercise(dIdx, eIdx, patch) {
    setWeeks((current) =>
      current.map((week, wIdx) =>
        wIdx !== weekIndex
          ? week
          : {
              ...week,
              days: week.days.map((day, i) =>
                i !== dIdx
                  ? day
                  : { ...day, exercises: day.exercises.map((ex, j) => (j === eIdx ? { ...ex, ...patch } : ex)) }
              ),
            }
      )
    )
  }

  function addExercise(dIdx) {
    setWeeks((current) =>
      current.map((week, wIdx) =>
        wIdx !== weekIndex
          ? week
          : {
              ...week,
              days: week.days.map((day, i) =>
                i !== dIdx ? day : { ...day, exercises: [...day.exercises, blankExercise(exercisesList)] }
              ),
            }
      )
    )
  }

  function removeExercise(dIdx, eIdx) {
    setWeeks((current) =>
      current.map((week, wIdx) =>
        wIdx !== weekIndex
          ? week
          : {
              ...week,
              days: week.days.map((day, i) =>
                i !== dIdx ? day : { ...day, exercises: day.exercises.filter((_, j) => j !== eIdx) }
              ),
            }
      )
    )
  }

  function addDay() {
    setWeeks((current) =>
      current.map((week, wIdx) => {
        if (wIdx !== weekIndex) return week
        const nextDayNumber = (week.days.at(-1)?.day_number ?? 0) + 1
        return {
          ...week,
          days: [
            ...week.days,
            { day_number: nextDayNumber, day_of_week: 1, slot: '', modality: 'strength', name: 'Nouvelle séance', exercises: [] },
          ],
        }
      })
    )
  }

  function removeDay(dIdx) {
    setWeeks((current) =>
      current.map((week, wIdx) => (wIdx !== weekIndex ? week : { ...week, days: week.days.filter((_, i) => i !== dIdx) }))
    )
  }

  async function handleSave() {
    setProgramError(null)
    setSaved(false)
    setProgramStatus('loading')

    try {
      const body = await authedFetch('/api/admin/program', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id, structure: { weeks } }),
      })
      setProgram(body.program)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setProgramError(err.message)
    }
    setProgramStatus('idle')
  }

  if (status === 'loading') return null

  const week = weeks[weekIndex]

  return (
    <main>
      <TopNav />
      <h1>Administration</h1>
      <p>Modifie manuellement le programme actif de n'importe quel utilisateur.</p>

      {error && <p role="alert">{error}</p>}

      <div className="admin-pending-requests card">
        <h2>Demandes de génération en attente ({pendingRequests.length})</h2>
        {approveError && <p role="alert">{approveError}</p>}
        {pendingRequests.length === 0 ? (
          <p>Aucune demande en attente.</p>
        ) : (
          <ul className="admin-pending-items">
            {pendingRequests.map((r) => (
              <li key={r.program_id} className="admin-pending-item">
                <span>
                  <strong>{r.full_name || r.email}</strong>
                  <span className="eyebrow">
                    {r.email}
                    {r.goal_type && ` · ${r.goal_type}`}
                    {' · demandé le '}
                    {new Date(r.created_at).toLocaleDateString('fr-CH')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleApprove(r.program_id)}
                  disabled={approvingId === r.program_id}
                >
                  {approvingId === r.program_id ? 'Approbation...' : 'Approuver'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-layout">
        <div className="admin-user-list card">
          <h2>Utilisateurs ({users.length})</h2>
          <ul className="admin-user-items">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className={`admin-user-item${selectedUser?.id === u.id ? ' admin-user-item-active' : ''}`}
                  onClick={() => openUser(u)}
                >
                  <span>{u.full_name || u.email}</span>
                  <span className="eyebrow">
                    {u.email}
                    {u.is_admin && ' · admin'}
                    {!u.onboarding_completed_at && ' · onboarding incomplet'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selectedUser && (
          <div className="admin-program-editor card">
            <h2>{selectedUser.full_name || selectedUser.email}</h2>

            {programStatus === 'loading' && !program && <p>Chargement...</p>}
            {programError && <p role="alert">{programError}</p>}

            {programStatus === 'idle' && !program && !programError && (
              <p>Aucun programme actif pour cet utilisateur.</p>
            )}

            {week && (
              <>
                <div className="week-nav">
                  <button
                    type="button"
                    className="nav-arrow"
                    onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                    disabled={weekIndex === 0}
                  >
                    ‹
                  </button>
                  <div className="week-nav-label">
                    <h3>Semaine {week.week_number}</h3>
                  </div>
                  <button
                    type="button"
                    className="nav-arrow"
                    onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))}
                    disabled={weekIndex === weeks.length - 1}
                  >
                    ›
                  </button>
                </div>

                {week.days.map((day, dIdx) => (
                  <div key={dIdx} className="admin-day-card">
                    <div className="admin-day-header">
                      <input
                        value={day.name}
                        onChange={(e) => updateDay(dIdx, { name: e.target.value })}
                        aria-label="Nom de la séance"
                      />
                      <select
                        value={day.day_of_week ?? 1}
                        onChange={(e) => updateDay(dIdx, { day_of_week: Number(e.target.value) })}
                        aria-label="Jour de la semaine"
                        title="Jour de la semaine"
                      >
                        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((label, i) => (
                          <option key={label} value={i + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={day.slot ?? ''}
                        onChange={(e) => updateDay(dIdx, { slot: e.target.value })}
                        aria-label="Moment de la journée"
                        title="Moment de la journée"
                      >
                        <option value="">Seule ce jour-là</option>
                        <option value="morning">Matin</option>
                        <option value="evening">Soir</option>
                      </select>
                      <input
                        value={day.modality ?? ''}
                        onChange={(e) => updateDay(dIdx, { modality: e.target.value })}
                        aria-label="Modalité"
                        title="Modalité (ex. strength, running, cardio)"
                        placeholder="modalité"
                      />
                      <button type="button" className="link-button" onClick={() => removeDay(dIdx)}>
                        Supprimer la séance
                      </button>
                    </div>

                    {day.exercises.map((exercise, eIdx) => (
                      <div key={eIdx} className="admin-exercise-row">
                        <select
                          value={exercise.exercise_id}
                          onChange={(e) => updateExercise(dIdx, eIdx, { exercise_id: e.target.value })}
                        >
                          {exercisesList.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name} — {ex.category}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(dIdx, eIdx, { sets: Number(e.target.value) })}
                          aria-label="Séries"
                          title="Séries"
                        />
                        <input
                          value={exercise.reps}
                          onChange={(e) => updateExercise(dIdx, eIdx, { reps: e.target.value })}
                          aria-label="Répétitions"
                          title="Répétitions"
                          placeholder="reps"
                        />
                        <input
                          type="number"
                          min="0"
                          value={exercise.rest_seconds}
                          onChange={(e) => updateExercise(dIdx, eIdx, { rest_seconds: Number(e.target.value) })}
                          aria-label="Repos (s)"
                          title="Repos (secondes)"
                        />
                        <input
                          value={exercise.notes}
                          onChange={(e) => updateExercise(dIdx, eIdx, { notes: e.target.value })}
                          aria-label="Notes"
                          placeholder="notes"
                        />
                        <button type="button" className="link-button" onClick={() => removeExercise(dIdx, eIdx)}>
                          ✕
                        </button>
                      </div>
                    ))}

                    <button type="button" onClick={() => addExercise(dIdx)}>
                      + Ajouter un exercice
                    </button>
                  </div>
                ))}

                <button type="button" onClick={addDay}>
                  + Ajouter une séance
                </button>

                <div style={{ marginTop: 16 }}>
                  <button type="button" onClick={handleSave} disabled={programStatus === 'loading'}>
                    {programStatus === 'loading' ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                  {saved && <p className="settings-saved">Enregistré ✓</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bottom-nav-spacer" />
      <BottomNav />
    </main>
  )
}
