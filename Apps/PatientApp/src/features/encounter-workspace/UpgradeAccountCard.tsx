import { type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { panelBorder, patientTheme } from '../../shared/ui/theme';

interface UpgradeAccountCardProps {
  returnTo: string;
}

export function UpgradeAccountCard({ returnTo }: UpgradeAccountCardProps) {
  const navigate = useNavigate();
  const { session: guestSession } = useGuestSession();

  if (!guestSession) return null;

  return (
    <article style={styles.card}>
      <header style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>Create Your Account</h3>
        <p style={styles.cardSubtitle}>
          Set a secure password on the signup page and keep this visit attached to your account.
        </p>
      </header>

      <div style={styles.callout}>
        <strong style={styles.calloutTitle}>What happens next</strong>
        <p style={styles.calloutBody}>
          We&apos;ll prefill the account setup form with the information already captured for this visit, then upgrade this same guest patient profile in place.
        </p>
      </div>

      <div style={styles.actionRow}>
        <button
          style={styles.primaryButton}
          onClick={() => navigate(`/auth/signup?mode=guest-upgrade&returnTo=${encodeURIComponent(returnTo)}`)}
        >
          Continue to secure signup
        </button>
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'linear-gradient(135deg, #f0f7ff 0%, #fffdf8 100%)',
    border: '1px solid #bfdbfe',
    borderRadius: patientTheme.radius.md,
    padding: '1rem',
    display: 'grid',
    gap: '0.9rem',
    boxShadow: '0 16px 36px rgba(59, 130, 246, 0.08)',
  },
  cardHeader: {
    display: 'grid',
    gap: '0.35rem',
  },
  cardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.05rem',
    color: patientTheme.colors.ink,
  },
  cardSubtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.9rem',
    lineHeight: 1.45,
  },
  callout: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'rgba(243, 239, 229, 0.78)',
    padding: '0.95rem 1rem',
    display: 'grid',
    gap: '0.45rem',
  },
  calloutTitle: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  calloutBody: {
    margin: 0,
    fontSize: '0.88rem',
    lineHeight: 1.5,
    color: patientTheme.colors.inkMuted,
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
};
