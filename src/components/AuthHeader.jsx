import { Link } from 'react-router-dom'

export default function AuthHeader({ subtitle }) {
  return (
    <div className="auth-header">
      <Link to="/" className="auth-brand">
        rou<span className="auth-brand-x">X</span>perf
      </Link>
      {subtitle && <p className="auth-subtitle">{subtitle}</p>}
    </div>
  )
}
