import { useNavigate } from 'react-router-dom';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.badge}>Priage Patient</div>
        <h1 style={styles.title}>Choose how you want to start.</h1>
        <p style={styles.subtitle}>
          Start a fast hospital check-in as a guest, or sign in to manage visits,
          messages, and your profile.
        </p>
      </div>

      <div style={styles.actions}>
        <button style={styles.primaryCard} onClick={() => navigate('/guest/start')}>
          <span style={styles.cardIcon}>+</span>
          <div>
            <div style={styles.cardTitle}>Quick Check-In</div>
            <div style={styles.cardBody}>
              Start a guest intake flow and notify the hospital you are on the way.
            </div>
          </div>
        </button>

        <button style={styles.secondaryCard} onClick={() => navigate('/auth/login')}>
          <span style={styles.cardIcon}>→</span>
          <div>
            <div style={styles.cardTitle}>Sign In</div>
            <div style={styles.cardBody}>
              Access your dashboard, messages, Priage AI, and saved profile.
            </div>
          </div>
        </button>

        <button style={styles.linkButton} onClick={() => navigate('/auth/signup')}>
          Create Account
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '2rem 1.5rem',
    background: 'linear-gradient(160deg, #f8fafc 0%, #dbeafe 48%, #eff6ff 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  hero: {
    maxWidth: '560px',
    margin: '0 auto',
    paddingTop: '2rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '1rem 0 0',
    fontSize: '2.4rem',
    lineHeight: 1.05,
    color: '#0f172a',
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: '1rem 0 0',
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#475569',
    maxWidth: '32rem',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    width: '100%',
    maxWidth: '560px',
    margin: '2rem auto 0',
  },
  primaryCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.9rem',
    width: '100%',
    padding: '1.2rem',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    color: '#fff',
    boxShadow: '0 18px 40px rgba(37, 99, 235, 0.22)',
    fontFamily: 'inherit',
  },
  secondaryCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.9rem',
    width: '100%',
    padding: '1.2rem',
    borderRadius: '20px',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
    textAlign: 'left',
    background: '#fff',
    color: '#0f172a',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
    fontFamily: 'inherit',
  },
  cardIcon: {
    width: '2rem',
    height: '2rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.18)',
    fontWeight: 800,
    fontSize: '1rem',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
  },
  cardBody: {
    marginTop: '0.25rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    opacity: 0.9,
  },
  linkButton: {
    width: '100%',
    padding: '0.95rem',
    borderRadius: '14px',
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
