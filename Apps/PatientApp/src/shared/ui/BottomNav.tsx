// Bottom navigation bar for the patient app.

import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/priage', label: 'Priage', icon: '🩺' },
  { path: '/messages', label: 'Messages', icon: '💬' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => {
        const active = tab.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.path);

        return (
          <button
            key={tab.path}
            style={{
              ...styles.tab,
              color: active ? '#1e3a5f' : '#94a3b8',
              fontWeight: active ? 700 : 500,
            }}
            onClick={() => navigate(tab.path)}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span style={styles.label}>{tab.label}</span>
            {active && <div style={styles.indicator} />}
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: '#ffffff',
    borderTop: '1px solid #e2e8f0',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: '64px',
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '8px 16px',
    position: 'relative',
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  },
  icon: {
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  label: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: '3px',
    borderRadius: '0 0 3px 3px',
    background: '#1e3a5f',
  },
};
