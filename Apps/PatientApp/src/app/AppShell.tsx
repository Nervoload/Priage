import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { Brand } from '../shared/ui/Brand';
import { cx } from '../shared/ui/cx';
import { Icon, type IconName } from '../shared/ui/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  active: (pathname: string) => boolean;
}

// Routes that are a single focused task: hide the mobile top bar and tab bar
// so the flow's own header and action footer have the whole screen.
const IMMERSIVE_PREFIXES = ['/priage'];

export function initialsFor(firstName?: string | null, lastName?: string | null, fallback?: string | null): string {
  const letters = [firstName, lastName].filter(Boolean).map((part) => part!.trim()[0]).join('');
  return (letters || fallback?.trim()[0] || 'P').toUpperCase().slice(0, 2);
}

export function AppShell({ variant, children }: { variant: 'account' | 'guest'; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { patient, logout, clearSession } = useAuth();
  const { session: guestSession } = useGuestSession();
  const [signingOut, setSigningOut] = useState(false);

  const visitPath = guestSession?.encounterId ? `/encounters/${guestSession.encounterId}/current` : '/';
  const items: NavItem[] = variant === 'account'
    ? [
        { to: '/', label: 'Home', icon: 'home', active: (path) => path === '/' || path.startsWith('/encounters/') || path.startsWith('/priage') },
        { to: '/messages', label: 'Messages', icon: 'message', active: (path) => path.startsWith('/messages') },
        { to: '/settings', label: 'Account', icon: 'user', active: (path) => path.startsWith('/settings') },
      ]
    : [
        { to: visitPath, label: 'Visit', icon: 'home', active: (path) => path.startsWith('/encounters/') },
        { to: '/messages', label: 'Messages', icon: 'message', active: (path) => path.startsWith('/messages') },
      ];

  const immersive = IMMERSIVE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const displayName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || patient?.email?.split('@')[0] || 'Patient';
  const initials = initialsFor(patient?.firstName, patient?.lastName, patient?.email);
  const upgradePath = `/auth/signup?mode=guest-upgrade&returnTo=${encodeURIComponent(location.pathname)}`;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      clearSession();
    } finally {
      setSigningOut(false);
      navigate('/welcome', { replace: true });
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidebar" aria-label="Priage">
        <div className="sidebar__brand">
          <Brand to={items[0].to} size={30} />
        </div>
        <nav className="sidebar__nav" aria-label="Main">
          {items.map((item) => (
            <Link key={item.label} to={item.to} className="nav-link" aria-current={item.active(location.pathname) ? 'page' : undefined}>
              <Icon name={item.icon} size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        {variant === 'account' && (
          <div className="sidebar__cta">
            <Link to="/priage" className="btn btn--secondary btn--sm btn--block">
              <Icon name="plus" size={18} />
              New visit
            </Link>
          </div>
        )}

        <div className="sidebar__footer">
          {variant === 'account' ? (
            <>
              <span className="avatar" aria-hidden="true">{initials}</span>
              <div className="sidebar__user">
                <span className="sidebar__user-name">{displayName}</span>
                <span className="sidebar__user-meta">{patient?.email}</span>
              </div>
              <button type="button" className="icon-btn icon-btn--bare" aria-label="Sign out" onClick={() => void handleSignOut()} disabled={signingOut}>
                <Icon name="logout" size={18} />
              </button>
            </>
          ) : (
            <div className="stack stack--sm" style={{ flex: 1, paddingRight: 4 }}>
              <span className="small">Create a password to keep this visit and its messages.</span>
              <Link to={upgradePath} className="btn btn--secondary btn--sm btn--block">Create account</Link>
            </div>
          )}
        </div>
      </aside>

      <div className="app-body">
        {!immersive && (
          <header className="topbar">
            <Brand to={items[0].to} />
            {variant === 'account' ? (
              <Link to="/settings" className="icon-btn icon-btn--bare" aria-label="Account">
                <span className="avatar" aria-hidden="true">{initials}</span>
              </Link>
            ) : (
              <Link to={upgradePath} className="text-btn">Create account</Link>
            )}
          </header>
        )}

        <div className={cx('app-main', immersive && 'app-main--immersive')}>{children}</div>
      </div>

      {!immersive && (
        <nav className="tabbar" aria-label="Main">
          {items.map((item) => (
            <Link key={item.label} to={item.to} className="tabbar__link" aria-current={item.active(location.pathname) ? 'page' : undefined}>
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
