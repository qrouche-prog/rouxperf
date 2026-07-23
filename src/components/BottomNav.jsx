import { NavLink } from 'react-router-dom'
import Icon from './onboarding/icons/Icon'

const ITEMS = [
  { to: '/dashboard', icon: 'home', label: 'Accueil' },
  { to: '/program', icon: 'dumbbell', label: 'Programme' },
  { to: '/progress', icon: 'run', label: 'Progrès' },
  { to: '/settings', icon: 'settings', label: 'Réglages' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item-active' : ''}`}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
