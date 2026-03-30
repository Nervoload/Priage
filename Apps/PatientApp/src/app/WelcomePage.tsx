import { useNavigate } from 'react-router-dom';

import { useGuestSession } from '../shared/hooks/useGuestSession';
import { getGuestResumeLabel, resolveGuestPath } from '../shared/guestFlow';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';

export function WelcomePage() {
  const navigate = useNavigate();
  const { session: guestSession } = useGuestSession();
  const guestPath = resolveGuestPath(guestSession);
  const resumeLabel = getGuestResumeLabel(guestSession);

  return (
    <main style={styles.page}>
      <section style={styles.mainArea}>
        <div style={styles.brand}>
          <span style={styles.badge}>Priage Patient</span>
          <h1 style={styles.title}>How would you like to continue?</h1>
        </div>

        <div style={styles.actions}>
          {guestSession && (
            <button style={styles.resumeAction} onClick={() => navigate(guestPath)}>
              <strong style={styles.actionTitle}>{resumeLabel}</strong>
              <span style={styles.actionBody}>Jump back into your saved guest flow without starting over.</span>
            </button>
          )}

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
    padding: '1.1rem',
    background: heroBackdrop,
    color: patientTheme.colors.ink,
    fontFamily: patientTheme.fonts.body,
  },
  mainArea: {
    flex: 1,
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: '1.12rem',
  },
  brand: {
    textAlign: 'center',
    display: 'grid',
    gap: '0.55rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'center',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.34rem 0.78rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: 'clamp(1.55rem, 4vw, 2.2rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  actions: {
    width: '100%',
    maxWidth: '540px',
    display: 'grid',
    gap: '0.66rem',
  },
  primaryAction: {
    border: 'none',
    borderRadius: patientTheme.radius.lg,
    background: 'linear-gradient(132deg, #1b3f9f 0%, #2156d1 100%)',
    color: '#fff',
    padding: '1.08rem 1.04rem',
    textAlign: 'left',
    boxShadow: '0 20px 42px -26px rgba(33, 86, 209, 0.45)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.24rem',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.18s ease',
  },
  resumeAction: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'linear-gradient(135deg, rgba(241, 247, 255, 0.98) 0%, rgba(255, 253, 248, 0.98) 100%)',
    color: patientTheme.colors.ink,
    padding: '1.08rem 1.04rem',
    textAlign: 'left',
    boxShadow: '0 18px 42px -36px rgba(20,33,61,0.42)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.24rem',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.18s ease',
  },
  secondaryAction: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    color: patientTheme.colors.ink,
    padding: '1.08rem 1.04rem',
    textAlign: 'left',
    boxShadow: '0 18px 42px -36px rgba(20,33,61,0.38)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.24rem',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.18s ease',
  },
  actionTitle: {
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.08rem',
    letterSpacing: '-0.01em',
  },
  actionBody: {
    fontSize: '0.9rem',
    lineHeight: 1.4,
    opacity: 0.9,
  },
  linkAction: {
    border: 'none',
    background: 'transparent',
    color: patientTheme.colors.accent,
    fontWeight: 700,
    textAlign: 'center',
    padding: '0.45rem',
    cursor: 'pointer',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
  },
};
