import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoMark from './Logo'

const LINKS = [
  { to: '/dashboard', label: 'Accueil' },
  { to: '/program', label: 'Programme' },
  { to: '/progress', label: 'Progrès' },
  { to: '/settings', label: 'Réglages' },
]

export default function TopNav() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    navigate('/', { replace: true })
    await signOut()
  }

  const links = profile?.is_admin ? [...LINKS, { to: '/admin', label: 'Admin' }] : LINKS

  return (
    <header className="top-nav">
      <Link to="/dashboard" className="top-nav-brand">
        <LogoMark size={24} />
        <span>
          rou<span className="flame-text">X</span>perf
        </span>
      </Link>
      <nav className="top-nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `top-nav-link${isActive ? ' top-nav-link-active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="top-nav-account">
        {user ? (
          <button type="button" className="top-nav-link top-nav-signout" onClick={handleSignOut}>
            Se déconnecter
          </button>
        ) : (
          <>
            <Link to="/login" className="top-nav-link">
              Se connecter
            </Link>
            <Link to="/signup" className="top-nav-link">
              S'inscrire
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
