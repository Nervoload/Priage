import { Link } from 'react-router-dom';

import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { Icon } from '../../shared/ui/Icon';

interface UpgradeAccountCardProps {
  returnTo: string;
}

export function UpgradeAccountCard({ returnTo }: UpgradeAccountCardProps) {
  const { session: guestSession } = useGuestSession();

  if (!guestSession) return null;

  return (
    <section className="card card--pad stack" aria-labelledby="upgrade-title">
      <div className="stack stack--xs">
        <h2 id="upgrade-title" className="heading">Keep this visit with an account</h2>
        <p className="body">Set a password and this visit, your answers and your messages stay together. We’ll fill in what you’ve already told us.</p>
      </div>
      <div>
        <Link to={`/auth/signup?mode=guest-upgrade&returnTo=${encodeURIComponent(returnTo)}`} className="btn btn--secondary">
          <Icon name="lock" size={18} />
          Create account
        </Link>
      </div>
    </section>
  );
}
