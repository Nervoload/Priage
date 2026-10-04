import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { Brand } from '../shared/ui/Brand';
import { cx } from '../shared/ui/cx';
import { Icon } from '../shared/ui/Icon';
import { CLINIC_JOURNEY_STEPS, clinicJourneyStep } from './clinicJourney';

export function ClinicPageFrame({ title, lede, children }: { title: ReactNode; lede?: ReactNode; children: ReactNode }) {
  const { session } = useAuth();
  const { alias } = useParams();
  const startPath = alias ? `/${alias}/start` : '/';
  const termsPath = alias ? `/clinic/${alias}/terms` : '/terms';
  const privacyPath = alias ? `/clinic/${alias}/privacy` : '/privacy';
  const accountPath = import.meta.env.VITE_CLINIC_PILOT_MODE === 'true' ? '/account' : '/settings';
  return (
    <div className="screen">
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="site-header">
        <Brand to={startPath} label="Clinic home" />
        <nav aria-label="Clinic links" className="site-nav">
          <Link to={termsPath}>Terms</Link>
          <Link to={privacyPath}>Privacy</Link>
          {session && <Link to={accountPath}>Account</Link>}
        </nav>
      </header>
      <main id="main" className="site-main">
        <div className="stack stack--sm">
          <h1 className="display">{title}</h1>
          {lede && <p className="lede">{lede}</p>}
        </div>
        {children}
      </main>
      <footer className="site-footer">Pilot preview. For help with your visit, contact the clinic.</footer>
    </div>
  );
}

const JOURNEY_NOTES = [
  'In progress',
  'Choose a time above',
  'We’ll email you when it’s confirmed',
  'Check in at the front desk',
  'Your clinician is with you',
  '',
];

export function ClinicJourney({ status, interviewStatus }: { status: string; interviewStatus?: string }) {
  const current = clinicJourneyStep(status, interviewStatus);
  // Ended visits are explained by the page headline; no timeline to show.
  if (current < 0) return null;
  return (
    <ol className="timeline" aria-label="Visit progress">
      {CLINIC_JOURNEY_STEPS.map((label, index) => (
        <li
          key={label}
          className={cx('timeline__item', index < current && 'is-done', index === current && 'is-current')}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="timeline__rail">
            <span className="timeline__dot">{index < current && <Icon name="check" size={11} strokeWidth={3} />}</span>
            <span className="timeline__line" />
          </span>
          <span className="timeline__text">
            <span>{label}</span>
            {index === current && JOURNEY_NOTES[index] && <span className="timeline__note">{JOURNEY_NOTES[index]}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
