import { useNavigate } from 'react-router-dom';

import { useDemo } from '../shared/demo';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';

export function WelcomePage() {
  const navigate = useNavigate();
  const {
    scenarios,
    selectedScenarioId,
    setSelectedScenarioId,
    selectedScenario,
  } = useDemo();

  const accountScenarios = scenarios.filter((scenario) => scenario.persona === 'authenticated');

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

      <section style={styles.demoTools}>
        <header style={styles.toolsHeader}>
          <h2 style={styles.toolsTitle}>Demo Tools</h2>
          <p style={styles.toolsBody}>
            Selected scenario: <strong>{selectedScenario.label}</strong>
          </p>
        </header>

        <div style={styles.scenarioGrid}>
          {scenarios.map((scenario) => {
            const active = selectedScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                style={{
                  ...styles.scenarioChip,
                  borderColor: active ? patientTheme.colors.accent : '#d7d1c3',
                  background: active ? '#edf3ff' : 'transparent',
                  color: active ? patientTheme.colors.accentStrong : patientTheme.colors.inkMuted,
                }}
                onClick={() => setSelectedScenarioId(scenario.id)}
              >
                {scenario.label}
              </button>
            );
          })}
        </div>

        <div style={styles.accountGrid}>
          {accountScenarios.map((scenario) => (
            <button
              key={scenario.id}
              style={styles.accountCard}
              onClick={() => {
                setSelectedScenarioId(scenario.id);
                navigate('/auth/login');
              }}
            >
              <strong>{scenario.label}</strong>
              <span>{scenario.authEmail ?? 'seeded account'}</span>
            </button>
          ))}
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
    justifyContent: 'space-between',
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
  demoTools: {
    maxWidth: '980px',
    margin: '0 auto',
    width: '100%',
    border: '1px dashed #cdc6b7',
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.72)',
    padding: '0.72rem',
    display: 'grid',
    gap: '0.55rem',
  },
  toolsHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  toolsTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.84rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: patientTheme.colors.inkMuted,
  },
  toolsBody: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.78rem',
  },
  scenarioGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.42rem',
  },
  scenarioChip: {
    border: '1px solid',
    borderRadius: '999px',
    background: 'transparent',
    padding: '0.28rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  accountGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.42rem',
  },
  accountCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: 'rgba(255,255,255,0.75)',
    padding: '0.52rem 0.58rem',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    display: 'grid',
    gap: '0.12rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.76rem',
  },
};
