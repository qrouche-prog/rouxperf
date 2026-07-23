import { Link, NavLink } from 'react-router-dom'
import LogoMark from './Logo'

const LINKS = [
  { to: '/dashboard', label: 'Accueil' },
  { to: '/program', label: 'Programme' },
  { to: '/progress', label: 'Progrès' },
]

export default function TopNav() {
  return (
    <header className="top-nav">
      <Link to="/dashboard" className="top-nav-brand">
        <LogoMark size={24} />
        roux<span className="flame-text">perf</span>
      </Link>
      <nav className="top-nav-links">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `top-nav-link${isActive ? ' top-nav-link-active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
