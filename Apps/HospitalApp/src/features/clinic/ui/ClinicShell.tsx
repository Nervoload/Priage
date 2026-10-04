import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/instrument-serif/400.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSocket } from '../../../shared/realtime/socket';
import { PriageLogo } from '../../../shared/ui/PriageLogo';
import { Icon, type IconName } from './Icon';
import { Dot, IconButton, cx } from './controls';

export type ClinicView = 'admit' | 'care' | 'analytics' | 'settings';

const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Reception',
  NURSE: 'Nurse',
  DOCTOR: 'Physician',
  ADMIN: 'Clinic admin',
  CLINICAL_ADMIN: 'Clinical admin',
  IT_ADMIN: 'IT admin',
};

export function Mark({ size = 30 }: { size?: number }) {
  return <PriageLogo size={size} />;
}

/**
 * Returns true to let navigation go ahead now. Returning false holds it; the
 * workspace can call `proceed` later, e.g. after its own confirm dialog.
 */
export type LeaveGuard = (proceed: () => void) => boolean;
const LeaveGuardContext = createContext<(guard: LeaveGuard | null) => void>(() => undefined);

/** Lets a workspace with unsaved work confirm before the shell navigates away or signs out. */
export function useLeaveGuard(guard: LeaveGuard) {
  const setGuard = useContext(LeaveGuardContext);
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => {
    setGuard((proceed) => latest.current(proceed));
    return () => setGuard(null);
  }, [setGuard]);
}

function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(() => getSocket().connected);
  useEffect(() => {
    const socket = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    setConnected(socket.connected);
    return () => { socket.off('connect', on); socket.off('disconnect', off); };
  }, []);
  return connected;
}

function initialsFor(email: string): string {
  const local = email.split('@')[0] || '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (letters || 'P').toUpperCase();
}

interface ClinicShellProps {
  current: ClinicView;
  views: ClinicView[];
  onNavigate: (view: ClinicView) => void;
  onLogout: () => void;
  user: { email: string; role: string };
  clinicName?: string;
  children: ReactNode;
}

// The clinic workspace frame: a quiet left rail with the three workspaces,
// connection state, and who is signed in.
export function ClinicShell({ current, views, onNavigate, onLogout, user, clinicName, children }: ClinicShellProps) {
  const connected = useSocketConnected();
  const guard = useRef<LeaveGuard | null>(null);
  const setGuard = useCallback((next: LeaveGuard | null) => { guard.current = next; }, []);
  const navigate = (view: ClinicView) => {
    if (view === current) return;
    const go = () => onNavigate(view);
    if (!guard.current || guard.current(go)) go();
  };
  const logout = () => { if (!guard.current || guard.current(onLogout)) onLogout(); };
  const items = views.map((view) => ({
    view,
    label: view === 'admit' ? (user.role === 'IT_ADMIN' ? 'Availability' : 'Reception') : view === 'care' ? 'Care' : view === 'analytics' ? 'Analytics' : 'Settings',
    icon: (view === 'admit' ? (user.role === 'IT_ADMIN' ? 'calendar' : 'reception') : view) as IconName,
  }));
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="flex min-h-screen bg-paper font-clinic text-ink antialiased">
      <a href="#clinic-main" className="sr-only z-[200] rounded-lg bg-white px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>

      <aside aria-label="Priage Clinic" className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-rail px-3 pb-3.5 pt-[18px] lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-6 pt-0.5">
          <Mark />
          <div className="min-w-0">
            <span className="block text-base font-semibold tracking-[-0.02em]">Priage Clinic</span>
            {clinicName && <span className="block truncate text-xs text-ink-3">{clinicName}</span>}
          </div>
        </div>
        <nav aria-label="Workspaces" className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.view === current;
            return (
              <button
                key={item.view}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.view)}
                className={cx(
                  'flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                  active ? 'bg-brand-tint text-brand-700' : 'text-ink hover:bg-ink/[.04]',
                )}
              >
                <Icon name={item.icon} size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="flex-1" />
        <p className="flex items-center gap-2 px-2.5 py-2.5 text-xs text-ink-2" title={connected ? 'Changes from other screens appear as they happen.' : 'Lists still refresh on their own every few seconds.'}>
          <Dot tone={connected ? 'green' : 'amber'} />
          {connected ? 'Live updates on' : 'Reconnecting'}
        </p>
        <div className="flex items-center gap-2.5 border-t border-line pb-0.5 pl-2 pr-1 pt-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{initialsFor(user.email)}</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold" title={user.email}>{user.email}</span>
            <span className="text-xs text-ink-3">{roleLabel}</span>
          </div>
          <IconButton icon="logout" label="Sign out" onClick={logout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-rail/95 px-3 backdrop-blur lg:hidden">
          <Mark size={26} />
          <nav aria-label="Workspaces" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {items.map((item) => (
              <button
                key={item.view}
                type="button"
                aria-current={item.view === current ? 'page' : undefined}
                onClick={() => navigate(item.view)}
                className={cx('flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-2.5 text-sm font-semibold', item.view === current ? 'bg-brand-tint text-brand-700' : 'text-ink-2')}
              >
                <Icon name={item.icon} size={17} />
                <span className="sr-only sm:not-sr-only">{item.label}</span>
              </button>
            ))}
          </nav>
          <Dot tone={connected ? 'green' : 'amber'} className="mx-1" />
          <IconButton icon="logout" label="Sign out" onClick={logout} />
        </header>
        <LeaveGuardContext.Provider value={setGuard}>
          <div id="clinic-main" className="flex min-w-0 flex-1 flex-col">{children}</div>
        </LeaveGuardContext.Provider>
      </div>
    </div>
  );
}

/** Serif page title with a quiet date beside it. */
export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-3.5">
      <h1 className="font-display text-[36px] font-normal leading-none tracking-[-0.01em]">{children}</h1>
      {aside && <span className="hidden truncate text-sm text-ink-3 sm:inline">{aside}</span>}
    </div>
  );
}

export function todayLabel(): string {
  return new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}
