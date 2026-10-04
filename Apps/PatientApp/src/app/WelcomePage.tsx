import { Link, useNavigate } from 'react-router-dom';

import { useGuestSession } from '../shared/hooks/useGuestSession';
import { getGuestResumeLabel, resolveGuestPath } from '../shared/guestFlow';
import { Brand } from '../shared/ui/Brand';
import { CtaButton } from '../shared/ui/Controls';
import { FlowScreen } from '../shared/ui/FlowScreen';
import { Icon } from '../shared/ui/Icon';

export function WelcomePage() {
  const navigate = useNavigate();
  const { session: guestSession } = useGuestSession();
  const guestPath = resolveGuestPath(guestSession);
  const resumeLabel = getGuestResumeLabel(guestSession);

  return (
    <FlowScreen
      label="Welcome"
      header={(
        <div className="brandbar">
          <Brand to="/welcome" />
          <Link to="/auth/login" className="pill-link">Sign in</Link>
        </div>
      )}
      footer={(
        <>
          <CtaButton onClick={() => navigate('/guest/start')}>Start a visit</CtaButton>
          <p className="flow__note">
            New here?
            <Link to="/auth/signup" className="text-btn" style={{ minHeight: 0 }}>Create an account</Link>
          </p>
        </>
      )}
    >
      <div className="stack stack--lg" style={{ paddingTop: 12 }}>
        <h1 className="display display--xl">Care starts before you arrive.</h1>
        <p className="lede">
          Tell us what’s going on, then choose where to go. Your care team reads your answers first, so you only explain once.
        </p>

        {guestSession && (
          <Link to={guestPath} className="link-card">
            <span className="tile__icon"><Icon name="clock" /></span>
            <span className="row__main">
              <span className="heading">{resumeLabel}</span>
              <span className="small">Pick up where you left off.</span>
            </span>
            <Icon name="chevronRight" />
          </Link>
        )}

        <ol className="index-list">
          <li><span className="index-list__n">1</span>Answer a few questions<span className="index-list__meta">About 5 minutes</span></li>
          <li><span className="index-list__n">2</span>Choose an emergency department or clinic</li>
          <li><span className="index-list__n">3</span>Stay in touch with your care team</li>
        </ol>

        <p className="safety-line">
          <Icon name="alertTriangle" size={18} />
          <span><strong>Emergency?</strong> Call 911 or go to the nearest emergency department. Don’t wait to finish this form.</span>
        </p>
      </div>
    </FlowScreen>
  );
}
