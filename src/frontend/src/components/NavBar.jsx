import { NavLink } from 'react-router-dom';

export default function NavBar({ onToggleSidebar }) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle conversation history"
          >
            ☰
          </button>
        )}
        <span className="navbar-brand">AI Rinpoche</span>
      </div>
      <nav className="navbar-links" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Chat
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          About
        </NavLink>
      </nav>
    </header>
  );
}
