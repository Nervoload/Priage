import {
  getDemoSessionMetadata,
  loadDemoState,
  submitDemoFeedback,
  trackDemoEvent,
} from '../../DemoShared/src/staticDemo';
import './styles.css';

type DemoSessionResponse = {
  ok: boolean;
  sessionId?: string;
  email?: string;
  expiresAt?: number;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Demo shell root not found');

const params = new URLSearchParams(window.location.search);
const sessionMeta = getDemoSessionMetadata();

let session: DemoSessionResponse | null = null;
let verificationError = '';
let verificationBusy = false;
let feedbackStatus = '';

void init();

async function init() {
  session = await fetchDemoSession();
  render();
  trackDemoEvent('demo_portal_loaded', {
    path: window.location.pathname,
    hasDemoCode: Boolean(sessionMeta.demoCode),
    hasDemoSessionId: Boolean(sessionMeta.demoSessionId),
    authenticated: Boolean(session?.ok),
  });
}

function render() {
  app.innerHTML = `
    <main class="demo-portal">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Priage Demo Access</p>
          <h1>Explore the patient and care-team experience.</h1>
          <p class="summary">
            Use the access code sent to your email to unlock a fictional, browser-local product demo.
            Once unlocked, you can launch either side of the Priage workflow.
          </p>
        </div>
        ${renderSessionCard()}
      </section>

      ${session?.ok ? renderUnlockedState() : renderAccessForm()}
    </main>
  `;

  bindEvents();
}

function renderSessionCard(): string {
  if (session?.ok) {
    return `
      <aside class="session-card unlocked">
        <span>Unlocked demo</span>
        <strong>${escapeHtml(session.email || 'Authorized visitor')}</strong>
        <small>${session.expiresAt ? `Access expires ${formatDate(session.expiresAt)}` : 'Access session active'}</small>
      </aside>
    `;
  }

  return `
    <aside class="session-card">
      <span>Demo status</span>
      <strong>Access required</strong>
      <small>Email and code are checked server-side.</small>
    </aside>
  `;
}

function renderAccessForm(): string {
  return `
    <section class="access-grid">
      <form id="access-form" class="access-card">
        <div>
          <p class="eyebrow">Enter Code</p>
          <h2>Unlock your demo</h2>
          <p class="body-copy">Enter the email and generated access code from your Priage demo invitation.</p>
        </div>

        ${verificationError ? `<p class="error-box">${escapeHtml(verificationError)}</p>` : ''}

        <label>
          Email
          <input name="email" type="email" autocomplete="email" placeholder="name@organization.com" required />
        </label>

        <label>
          Demo code
          <input name="code" type="text" inputmode="text" autocomplete="one-time-code" placeholder="ABC-123" required />
        </label>

        ${params.get('request') ? `<input name="requestId" type="hidden" value="${escapeHtml(params.get('request') || '')}" />` : ''}

        <button type="submit" ${verificationBusy ? 'disabled' : ''}>
          ${verificationBusy ? 'Verifying...' : 'Unlock demo'}
        </button>

        <p class="fine-print">
          Access is enforced by the Cloudflare demo gate. Copying a patient or care-team URL directly will not bypass it.
        </p>
      </form>

      <aside class="explain-card">
        <p class="eyebrow">What Opens Next</p>
        <h2>Two connected apps, one demo scenario.</h2>
        <p>
          The patient demo shows guest check-in, intake, hospital selection, status updates, and messaging.
          The care-team demo shows admittance, triage, waiting-room monitoring, messaging, analytics, and settings.
        </p>
      </aside>
    </section>
  `;
}

function renderUnlockedState(): string {
  const metadata = new URLSearchParams();
  metadata.set('demo', 'static');
  metadata.set('tour', '1');
  if (session?.sessionId) metadata.set('demoSessionId', session.sessionId);
  if (sessionMeta.demoCode) metadata.set('demoCode', sessionMeta.demoCode);

  const patientUrl = `/demo/patient/?${metadata.toString()}&showcase=patient`;
  const hospitalUrl = `/demo/hospital/?${metadata.toString()}&showcase=hospital`;
  const state = loadDemoState();

  return `
    <section class="launch-grid" aria-label="Demo app launchers">
      <a class="launch-card patient" href="${patientUrl}" target="_blank" rel="noreferrer" data-launch="patient">
        <span class="launch-kicker">Patient App</span>
        <strong>Try the patient journey</strong>
        <small>Guided guest check-in, intake interview, hospital selection, status updates, and patient messaging.</small>
      </a>

      <a class="launch-card care" href="${hospitalUrl}" target="_blank" rel="noreferrer" data-launch="hospital">
        <span class="launch-kicker">Care Team App</span>
        <strong>Try the hospital workflow</strong>
        <small>Guided admittance, triage, waiting-room monitoring, messaging, analytics, and configuration tour.</small>
      </a>
    </section>

    <section class="utility-grid">
      <form id="feedback-form" class="feedback-card">
        <div>
          <p class="eyebrow">Feedback</p>
          <h2>Capture demo notes</h2>
        </div>
        <label>
          Rating
          <select name="rating" aria-label="Rating">
            <option value="">Choose one</option>
            <option value="high-fit">Strong fit</option>
            <option value="worth-followup">Worth a follow-up</option>
            <option value="unclear">Need more context</option>
          </select>
        </label>
        <label>
          Email for follow-up
          <input name="email" type="email" aria-label="Email for follow-up" placeholder="name@organization.com" value="${escapeHtml(session?.email || '')}" />
        </label>
        <label>
          Notes
          <textarea name="message" rows="3" aria-label="Notes" placeholder="What should the sales team know?"></textarea>
        </label>
        <button type="submit">Save feedback</button>
        <p class="status" role="status">${escapeHtml(feedbackStatus)}</p>
      </form>

      <aside class="metrics-card">
        <p class="eyebrow">Local Scenario</p>
        <h2>${state.encounters.length} demo encounters</h2>
        <p>${state.events.length} local interaction events recorded in this browser.</p>
        <p class="fine-print">The app data is fictional and local to this browser after access is granted.</p>
      </aside>
    </section>
  `;
}

function bindEvents() {
  document.querySelector<HTMLFormElement>('#access-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void verifyAccess({
      email: String(formData.get('email') || ''),
      code: String(formData.get('code') || ''),
      requestId: String(formData.get('requestId') || '') || null,
    });
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-launch]').forEach((link) => {
    link.addEventListener('click', () => {
      trackDemoEvent('demo_portal_app_opened', { app: link.dataset.launch });
    });
  });

  document.querySelector<HTMLFormElement>('#feedback-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    submitDemoFeedback({
      rating: String(formData.get('rating') || ''),
      email: String(formData.get('email') || ''),
      message: String(formData.get('message') || ''),
    });
    feedbackStatus = 'Feedback saved locally for this demo session.';
    form.reset();
    render();
  });
}

async function verifyAccess(input: { email: string; code: string; requestId: string | null }) {
  verificationBusy = true;
  verificationError = '';
  render();

  try {
    const response = await fetch('/api/verify-demo-code', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({ ok: false, error: 'Unable to verify that demo code.' }));

    if (!response.ok || !body.ok) {
      verificationError = typeof body.error === 'string' ? body.error : 'Unable to verify that demo code.';
      verificationBusy = false;
      render();
      return;
    }

    session = await fetchDemoSession();
    verificationBusy = false;
    trackDemoEvent('demo_portal_access_verified', { hasSession: Boolean(session?.ok) });
    render();
  } catch {
    verificationError = 'Unable to reach the demo access service. Please try again.';
    verificationBusy = false;
    render();
  }
}

async function fetchDemoSession(): Promise<DemoSessionResponse | null> {
  try {
    const response = await fetch('/api/demo-session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = await response.json() as DemoSessionResponse;
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#039;';
    }
  });
}
