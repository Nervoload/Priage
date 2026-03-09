import { useNavigate } from 'react-router-dom';

import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <main style={styles.page}>
      <section style={styles.mainArea}>
        <div style={styles.brand}>
          <span style={styles.badge}>Priage Patient</span>
          <h1 style={styles.title}>How would you like to continue?</h1>
        </div>

        <div style={styles.actions}>
          <button style={styles.primaryAction} onClick={() => navigate('/guest/start')}>
            <strong style={styles.actionTitle}>Quick Check-In</strong>
            <span style={styles.actionBody}>Start as a guest and notify the hospital immediately.</span>
          </button>

          <button style={styles.secondaryAction} onClick={() => navigate('/auth/login')}>
            <strong style={styles.actionTitle}>Sign In</strong>
            <span style={styles.actionBody}>Open your account, active visit, and message history.</span>
          </button>

          <button style={styles.linkAction} onClick={() => navigate('/auth/signup')}>
            Create account
          </button>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '1rem',
    background: heroBackdrop,
    color: patientTheme.colors.ink,
    fontFamily: patientTheme.fonts.body,
  },
  mainArea: {
    flex: 1,
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: '1rem',
  },
  brand: {
    textAlign: 'center',
    display: 'grid',
    gap: '0.45rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'center',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.3rem 0.72rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: 'clamp(1.45rem, 4vw, 2.15rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  actions: {
    width: '100%',
    maxWidth: '500px',
    display: 'grid',
    gap: '0.58rem',
  },
  primaryAction: {
    border: 'none',
    borderRadius: patientTheme.radius.lg,
    background: 'linear-gradient(132deg, #1b3f9f 0%, #2156d1 100%)',
    color: '#fff',
    padding: '1rem',
    textAlign: 'left',
    boxShadow: '0 16px 36px rgba(33, 86, 209, 0.28)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.24rem',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryAction: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    color: patientTheme.colors.ink,
    padding: '1rem',
    textAlign: 'left',
    boxShadow: patientTheme.shadows.card,
    cursor: 'pointer',
    display: 'grid',
    gap: '0.24rem',
    fontFamily: patientTheme.fonts.body,
  },
  actionTitle: {
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.03rem',
  },
  actionBody: {
    fontSize: '0.87rem',
    lineHeight: 1.4,
    opacity: 0.9,
  },
  linkAction: {
    border: 'none',
    background: 'transparent',
    color: patientTheme.colors.accent,
    fontWeight: 700,
    textAlign: 'center',
    padding: '0.35rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
};
