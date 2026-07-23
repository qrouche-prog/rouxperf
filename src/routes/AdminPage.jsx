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

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const [selectedUser, setSelectedUser] = useState(null)
  const [program, setProgram] = useState(null)
  const [structureText, setStructureText] = useState('')
  const [programStatus, setProgramStatus] = useState('idle')
  const [programError, setProgramError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const body = await authedFetch('/api/admin/users')
        setUsers(body.users)
      } catch (err) {
        setError(err.message)
      }
      setStatus('idle')
    }
    load()
  }, [])

  async function openUser(user) {
    setSelectedUser(user)
    setProgram(null)
    setStructureText('')
    setProgramError(null)
    setSaved(false)
    setProgramStatus('loading')

    try {
      const body = await authedFetch(`/api/admin/program?user_id=${user.id}`)
      setProgram(body.program)
      setStructureText(body.program ? JSON.stringify(body.program.structure, null, 2) : '')
    } catch (err) {
      setProgramError(err.message)
    }
    setProgramStatus('idle')
  }

  async function handleSave() {
    setProgramError(null)
    setSaved(false)

    let structure
    try {
      structure = JSON.parse(structureText)
    } catch {
      setProgramError('JSON invalide — vérifie la syntaxe.')
      return
    }

    setProgramStatus('loading')
    try {
      const body = await authedFetch('/api/admin/program', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id, structure }),
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

  return (
    <main>
      <TopNav />
      <h1>Administration</h1>
      <p>Modifie manuellement le programme actif de n'importe quel utilisateur.</p>

      {error && <p role="alert">{error}</p>}

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

            {program && (
              <>
                <label htmlFor="structureEditor">
                  Structure JSON du programme (semaines / jours / exercices)
                </label>
                <textarea
                  id="structureEditor"
                  value={structureText}
                  onChange={(e) => setStructureText(e.target.value)}
                  rows={20}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
                <button type="button" onClick={handleSave} disabled={programStatus === 'loading'}>
                  {programStatus === 'loading' ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
                {saved && <p className="settings-saved">Enregistré ✓</p>}
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
