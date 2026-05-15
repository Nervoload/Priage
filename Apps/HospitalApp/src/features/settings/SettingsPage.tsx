import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  getHospital,
  listAdmittanceFeedback,
  submitAdmittanceFeedback,
  updateHospitalDetails,
  updateHospitalConfig,
} from '../../shared/api/hospitals';
import { listUsers, updateMyProfile } from '../../shared/api/users';
import {
  HOSPITAL_PAGE_KEYS,
  type AuthUser,
  type HospitalConfigEnvelope,
  type HospitalCustomIntakeQuestion,
  type HospitalFeedbackSubmission,
  type HospitalFeedbackSurveyQuestion,
  type HospitalPageKey,
  type HospitalStaffListItem,
  type HospitalSummary,
  type HospitalOperationalConfig,
  type Role,
} from '../../shared/types/domain';
import { getPreferredLandingPage, setPreferredLandingPage } from '../../shared/settings/preferences';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { DASHBOARD_PAGE_CLASS } from '../../shared/ui/dashboardTheme';
import { Modal } from '../../shared/ui/Modal';
import { useToast } from '../../shared/ui/ToastContext';

interface SettingsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: AuthUser | null;
  availableViews: View[];
  configEnvelope: HospitalConfigEnvelope;
  onConfigUpdated: (response: HospitalConfigEnvelope) => void;
}

type DashboardSection = 'general' | 'staff' | 'patients' | 'feedback';

const PAGE_LABELS: Record<HospitalPageKey, string> = {
  admit: 'Admittance',
  triage: 'Triage',
  waiting: 'Waiting Room',
  analytics: 'Analytics',
  settings: 'Settings',
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  NURSE: 'Nurse',
  STAFF: 'Admittance / Staff',
  DOCTOR: 'Doctor',
};

const ROLE_ORDER: Role[] = ['ADMIN', 'DOCTOR', 'NURSE', 'STAFF'];

const INTAKE_RESPONSE_TYPES: Array<HospitalCustomIntakeQuestion['responseType']> = [
  'text',
  'textarea',
  'boolean',
  'number',
  'select',
];

const SURVEY_RESPONSE_TYPES: Array<HospitalFeedbackSurveyQuestion['responseType']> = [
  'scale',
  'text',
  'boolean',
];

function cloneConfig(config: HospitalOperationalConfig): HospitalOperationalConfig {
  return JSON.parse(JSON.stringify(config)) as HospitalOperationalConfig;
}

function buildLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function ensureSettingsVisible(config: HospitalOperationalConfig): HospitalOperationalConfig {
  const next = cloneConfig(config);
  (Object.keys(next.pageAccess) as Role[]).forEach((role) => {
    const current = new Set<HospitalPageKey>(next.pageAccess[role]);
    current.add('settings');
    next.pageAccess[role] = HOSPITAL_PAGE_KEYS.filter((page) => current.has(page));
  });
  return next;
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  event.currentTarget.blur();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getSectionMeta(
  section: DashboardSection,
  isAdmin: boolean,
): { eyebrow: string; title: string; description: string; saveLabel: string | null } {
  switch (section) {
    case 'general':
      return {
        eyebrow: isAdmin ? 'Admin Console' : 'Account',
        title: isAdmin ? 'General Administration' : 'General Settings',
        description: 'Review account credentials and hospital information for this clinic environment.',
        saveLabel: null,
      };
    case 'staff':
      return {
        eyebrow: 'Staff',
        title: 'Workspaces, Roles, and Access',
        description: 'Control which workspaces load for each role and review how staffing is distributed across the clinic.',
        saveLabel: 'Save Staff Settings',
      };
    case 'patients':
      return {
        eyebrow: 'Patients',
        title: 'Intake Form Configuration',
        description: 'Shape the intake form and the admittance review checklist used by clinic staff.',
        saveLabel: 'Save Intake Settings',
      };
    case 'feedback':
      return {
        eyebrow: 'Feedback',
        title: 'Survey and Bug Reports',
        description: 'Collect operational survey feedback from the admittance team and capture workflow bugs in the same place.',
        saveLabel: 'Save Feedback Settings',
      };
  }
}

export function SettingsPage({
  onNavigate,
  onLogout,
  user,
  availableViews,
  configEnvelope,
  onConfigUpdated,
}: SettingsPageProps) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<DashboardSection>('general');
  const [draftConfig, setDraftConfig] = useState<HospitalOperationalConfig>(() => cloneConfig(configEnvelope.config));
  const [hospitalSummary, setHospitalSummary] = useState<HospitalSummary | null>(null);
  const [staffAccounts, setStaffAccounts] = useState<HospitalStaffListItem[]>([]);
  const [loadingHospitalSummary, setLoadingHospitalSummary] = useState(false);
  const [loadingStaffAccounts, setLoadingStaffAccounts] = useState(false);
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredLandingPage, setPreferredLandingPageState] = useState<HospitalPageKey>('settings');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [savingHospitalDetails, setSavingHospitalDetails] = useState(false);
  const [feedbackSubmissions, setFeedbackSubmissions] = useState<HospitalFeedbackSubmission[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<Record<string, string>>({});
  const [bugReport, setBugReport] = useState('');
  const [isEditingHospitalDetails, setIsEditingHospitalDetails] = useState(false);
  const [hospitalDraftName, setHospitalDraftName] = useState('');
  const [hospitalDraftSlug, setHospitalDraftSlug] = useState('');
  const [hospitalConfirmPassword, setHospitalConfirmPassword] = useState('');
  const [showHospitalConfirmModal, setShowHospitalConfirmModal] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const canViewFeedbackHistory = user?.role === 'ADMIN' || user?.role === 'NURSE' || user?.role === 'DOCTOR';
  const canViewRoleDirectory = isAdmin;
  const liveSurveyQuestions = configEnvelope.config.admittanceFeedbackSurvey;
  const liveVisiblePages = availableViews;

  const sections = useMemo<Array<{ id: DashboardSection; label: string; description: string }>>(() => {
    if (isAdmin) {
      return [
        { id: 'general', label: 'General', description: 'Account and hospital information' },
        { id: 'staff', label: 'Staff', description: 'Roles and workspace access' },
        { id: 'patients', label: 'Patients', description: 'Intake form configuration' },
        { id: 'feedback', label: 'Feedback', description: 'Survey and bug reporting' },
      ];
    }

    return [
      { id: 'general', label: 'General', description: 'Account and hospital information' },
      { id: 'feedback', label: 'Feedback', description: 'Survey and bug reporting' },
    ];
  }, [isAdmin]);

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSection)) {
      setActiveSection(sections[0]?.id ?? 'general');
    }
  }, [activeSection, sections]);

  useEffect(() => {
    setDraftConfig(cloneConfig(configEnvelope.config));
  }, [configEnvelope.config]);

  useEffect(() => {
    setProfileEmail(user?.email ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const preferred = getPreferredLandingPage(user.userId, liveVisiblePages);
    setPreferredLandingPageState(preferred ?? liveVisiblePages[0] ?? 'settings');
  }, [liveVisiblePages, user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoadingHospitalSummary(true);

    void getHospital(user.hospitalId)
      .then((summary) => {
        if (!cancelled) setHospitalSummary(summary);
      })
      .catch((error) => {
        console.error('[SettingsPage] Failed to load hospital details:', error);
        if (!cancelled) showToast('Could not load hospital details.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingHospitalSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showToast, user]);

  useEffect(() => {
    if (!user || !canViewRoleDirectory) return;

    let cancelled = false;
    setLoadingStaffAccounts(true);

    void listUsers()
      .then((accounts) => {
        if (!cancelled) setStaffAccounts(accounts);
      })
      .catch((error) => {
        console.error('[SettingsPage] Failed to load staff accounts:', error);
        if (!cancelled) showToast('Could not load staff directory details.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingStaffAccounts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canViewRoleDirectory, showToast, user, configEnvelope.updatedAt]);

  const loadFeedback = useCallback(async () => {
    if (!user || !canViewFeedbackHistory) return;
    try {
      const items = await listAdmittanceFeedback(user.hospitalId, 12);
      setFeedbackSubmissions(items);
    } catch (error) {
      console.error('[SettingsPage] Failed to load admittance feedback:', error);
      showToast('Could not load recent admittance feedback.', 'error');
    }
  }, [canViewFeedbackHistory, showToast, user]);

  useEffect(() => {
    if (!user || !canViewFeedbackHistory) return;
    void loadFeedback();
  }, [canViewFeedbackHistory, loadFeedback, user, configEnvelope.updatedAt]);

  const roleCounts = useMemo<Record<Role, number>>(() => {
    const counts: Record<Role, number> = {
      ADMIN: 0,
      DOCTOR: 0,
      NURSE: 0,
      STAFF: 0,
    };

    staffAccounts.forEach((account) => {
      counts[account.role] += 1;
    });

    return counts;
  }, [staffAccounts]);

  const draftVisiblePages = useMemo(
    () => (user ? draftConfig.pageAccess[user.role] : []),
    [draftConfig.pageAccess, user],
  );

  const sectionMeta = getSectionMeta(activeSection, isAdmin);
  const canSaveConfig = isAdmin && activeSection !== 'general';

  useEffect(() => {
    const nextName = hospitalSummary?.name ?? user?.hospital?.name ?? '';
    const nextSlug = hospitalSummary?.slug ?? user?.hospital?.slug ?? '';
    setHospitalDraftName(nextName);
    setHospitalDraftSlug(nextSlug);
  }, [hospitalSummary, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (newPassword && newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    const payload = {
      email: profileEmail.trim() !== user.email ? profileEmail.trim() : undefined,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
    };

    if (!payload.email && !payload.newPassword) {
      showToast('No account changes to save.', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      await updateMyProfile(payload);
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Account settings updated.', 'success');
    } catch (error) {
      console.error('[SettingsPage] Failed to update staff profile:', error);
      showToast(error instanceof Error ? error.message : 'Could not update account settings.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLandingPage = () => {
    if (!user) return;
    setPreferredLandingPage(user.userId, preferredLandingPage);
    showToast('Role-specific landing page saved for this account.', 'success');
  };

  const handleSaveAdminSettings = async () => {
    if (!user || !isAdmin) return;

    const payload = ensureSettingsVisible(draftConfig);
    setSavingConfig(true);
    try {
      const response = await updateHospitalConfig(user.hospitalId, payload);
      setDraftConfig(cloneConfig(response.config));
      onConfigUpdated(response);
      showToast('Hospital deployment settings saved.', 'success');
    } catch (error) {
      console.error('[SettingsPage] Failed to save hospital configuration:', error);
      showToast(error instanceof Error ? error.message : 'Could not save hospital settings.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const closeHospitalConfirmModal = () => {
    setShowHospitalConfirmModal(false);
    setHospitalConfirmPassword('');
  };

  const handleSaveHospitalDetails = async () => {
    if (!user) return;

    const nextName = hospitalDraftName.trim();
    const nextSlug = hospitalDraftSlug.trim().toLowerCase();
    if (!nextName || !nextSlug) {
      showToast('Hospital name and slug are required.', 'error');
      return;
    }
    if (!hospitalConfirmPassword) {
      showToast('Enter your administrator password to confirm changes.', 'error');
      return;
    }

    setSavingHospitalDetails(true);
    try {
      const summary = await updateHospitalDetails(user.hospitalId, {
        name: nextName,
        slug: nextSlug,
        currentPassword: hospitalConfirmPassword,
      });
      setHospitalSummary(summary);
      await refreshUser();
      setIsEditingHospitalDetails(false);
      closeHospitalConfirmModal();
      showToast('Hospital settings updated.', 'success');
    } catch (error) {
      console.error('[SettingsPage] Failed to update hospital details:', error);
      showToast(error instanceof Error ? error.message : 'Could not update hospital settings.', 'error');
    } finally {
      setSavingHospitalDetails(false);
    }
  };

  const togglePageAccess = (role: Role, page: HospitalPageKey) => {
    if (page === 'settings') return;

    setDraftConfig((current) => {
      const next = cloneConfig(current);
      const entries = new Set(next.pageAccess[role]);
      if (entries.has(page)) {
        entries.delete(page);
      } else {
        entries.add(page);
      }
      next.pageAccess[role] = HOSPITAL_PAGE_KEYS.filter((candidate) => entries.has(candidate) || candidate === 'settings');
      return next;
    });
  };

  const addIntakeQuestion = () => {
    setDraftConfig((current) => {
      const next = cloneConfig(current);
      next.customIntakeQuestions.push({
        id: buildLocalId('intake'),
        fieldKey: buildLocalId('field'),
        label: 'New intake question',
        helpText: '',
        required: false,
        responseType: 'text',
        appliesTo: 'admit',
      });
      return next;
    });
  };

  const updateIntakeQuestion = (
    id: string,
    field: keyof HospitalCustomIntakeQuestion,
    value: string | boolean,
  ) => {
    setDraftConfig((current) => {
      const next = cloneConfig(current);
      next.customIntakeQuestions = next.customIntakeQuestions.map((question) => {
        if (question.id !== id) return question;

        if (field === 'fieldKey') {
          return { ...question, fieldKey: slugify(String(value), question.fieldKey) };
        }

        return {
          ...question,
          [field]: value,
        };
      });
      return next;
    });
  };

  const removeIntakeQuestion = (id: string) => {
    setDraftConfig((current) => ({
      ...cloneConfig(current),
      customIntakeQuestions: current.customIntakeQuestions.filter((question) => question.id !== id),
    }));
  };

  const addSurveyQuestion = () => {
    setDraftConfig((current) => {
      const next = cloneConfig(current);
      next.admittanceFeedbackSurvey.push({
        id: buildLocalId('feedback'),
        prompt: 'New feedback question',
        description: '',
        required: false,
        responseType: 'text',
      });
      return next;
    });
  };

  const updateSurveyQuestion = (
    id: string,
    field: keyof HospitalFeedbackSurveyQuestion,
    value: string | boolean,
  ) => {
    setDraftConfig((current) => {
      const next = cloneConfig(current);
      next.admittanceFeedbackSurvey = next.admittanceFeedbackSurvey.map((question) => (
        question.id === id
          ? { ...question, [field]: value }
          : question
      ));
      return next;
    });
  };

  const removeSurveyQuestion = (id: string) => {
    setDraftConfig((current) => ({
      ...cloneConfig(current),
      admittanceFeedbackSurvey: current.admittanceFeedbackSurvey.filter((question) => question.id !== id),
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!user) return;

    const missingRequired = liveSurveyQuestions.some((question) => question.required && !surveyResponses[question.id]?.trim());
    if (missingRequired) {
      showToast('Please answer all required survey questions before submitting.', 'error');
      return;
    }

    const trimmedBugReport = bugReport.trim();
    const responses = liveSurveyQuestions
      .filter((question) => surveyResponses[question.id]?.trim())
      .map((question) => ({
        questionId: question.id,
        prompt: question.prompt,
        answer: surveyResponses[question.id],
      }));

    if (responses.length === 0 && !trimmedBugReport) {
      showToast('Add survey feedback or a bug report before submitting.', 'error');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await submitAdmittanceFeedback(user.hospitalId, responses, trimmedBugReport || undefined);
      setSurveyResponses({});
      setBugReport('');
      showToast('Feedback submitted.', 'success');
      if (canViewFeedbackHistory) {
        await loadFeedback();
      }
    } catch (error) {
      console.error('[SettingsPage] Failed to submit feedback:', error);
      showToast(error instanceof Error ? error.message : 'Could not submit feedback.', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar
        currentView="settings"
        onNavigate={onNavigate}
        onLogout={onLogout}
        user={user ? { email: user.email, role: user.role } : null}
        availableViews={availableViews}
      />

      <div className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-5 lg:min-h-[calc(100vh-5rem)] lg:px-6 lg:pl-[20rem]">
        <aside
          className="mb-6 lg:mb-0 lg:w-[240px] lg:fixed lg:top-1/2 lg:-translate-y-1/2"
          style={{
            left: 'max(1rem, calc((100vw - 1500px) / 2 + 1rem))',
          }}
        >
          <div className="rounded-[30px] border border-white/80 bg-white/88 px-5 py-6 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.48)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {isAdmin ? 'Admin Dashboard' : 'Settings'}
            </div>
            <div className="mt-3 font-hospital-display text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {user?.hospital?.name ?? 'Clinic'}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {user ? ROLE_LABELS[user.role] : 'Signed out'}
            </div>

            <div className="mt-8 space-y-2">
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      group relative flex w-full items-center justify-between rounded-[18px] px-2 py-2.5 text-left transition-colors
                      ${isActive ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}
                    `}
                  >
                    <span className="relative pr-5">
                      <span className={`text-[1.02rem] ${isActive ? 'font-bold' : 'font-medium'}`}>
                        {section.label}
                      </span>
                      <span
                        className={`
                          absolute -bottom-1 left-0 h-[2px] rounded-full bg-black transition-all duration-300
                          ${isActive ? 'w-full' : 'w-0 group-hover:w-8'}
                        `}
                      />
                    </span>
                    <span
                      className={`
                        h-2.5 w-2.5 rounded-full bg-slate-950 transition-all duration-300
                        ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-1 opacity-0'}
                      `}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-[32px] border border-white/80 bg-white/90 px-6 py-6 shadow-[0_28px_80px_-50px_rgba(15,23,42,0.46)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-priage-600">
                  {sectionMeta.eyebrow}
                </div>
                <h1 className="mt-2 font-hospital-display text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  {sectionMeta.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {sectionMeta.description}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 text-sm text-slate-500 lg:items-end">
                <div>
                  <span className="font-semibold text-slate-700">Hospital:</span> {user?.hospital?.name ?? 'Unknown'}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Last admin save:</span> {formatDateTime(configEnvelope.updatedAt)}
                </div>
                {canSaveConfig && sectionMeta.saveLabel && (
                  <button
                    onClick={() => void handleSaveAdminSettings()}
                    disabled={savingConfig}
                    className="mt-2 rounded-[18px] bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_42px_-24px_rgba(220,38,38,0.58)] transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingConfig ? 'Saving…' : sectionMeta.saveLabel}
                  </button>
                )}
              </div>
            </div>
          </section>

          {activeSection === 'general' && (
            <GeneralSection
              canEditHospitalDetails={isAdmin}
              user={user}
              hospitalSummary={hospitalSummary}
              loadingHospitalSummary={loadingHospitalSummary}
              isEditingHospitalDetails={isEditingHospitalDetails}
              profileEmail={profileEmail}
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              savingProfile={savingProfile}
              hospitalDraftName={hospitalDraftName}
              hospitalDraftSlug={hospitalDraftSlug}
              setProfileEmail={setProfileEmail}
              setCurrentPassword={setCurrentPassword}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              setHospitalDraftName={setHospitalDraftName}
              setHospitalDraftSlug={setHospitalDraftSlug}
              onStartHospitalEdit={() => setIsEditingHospitalDetails(true)}
              onCancelHospitalEdit={() => {
                setIsEditingHospitalDetails(false);
                setHospitalDraftName(hospitalSummary?.name ?? user?.hospital?.name ?? '');
                setHospitalDraftSlug(hospitalSummary?.slug ?? user?.hospital?.slug ?? '');
              }}
              onRequestHospitalSave={() => setShowHospitalConfirmModal(true)}
              onSaveProfile={handleSaveProfile}
            />
          )}

          {activeSection === 'staff' && isAdmin && (
            <StaffSection
              isAdmin={isAdmin}
              canViewRoleDirectory={canViewRoleDirectory}
              loadingStaffAccounts={loadingStaffAccounts}
              roleCounts={roleCounts}
              draftConfig={draftConfig}
              draftVisiblePages={draftVisiblePages}
              liveVisiblePages={liveVisiblePages}
              preferredLandingPage={preferredLandingPage}
              setPreferredLandingPageState={setPreferredLandingPageState}
              onSaveLandingPage={handleSaveLandingPage}
              onTogglePageAccess={togglePageAccess}
            />
          )}

          {activeSection === 'patients' && isAdmin && (
            <PatientsSection
              draftConfig={draftConfig}
              onAddIntakeQuestion={addIntakeQuestion}
              onUpdateIntakeQuestion={updateIntakeQuestion}
              onRemoveIntakeQuestion={removeIntakeQuestion}
            />
          )}

          {activeSection === 'feedback' && (
            <FeedbackSection
              isAdmin={isAdmin}
              canViewFeedbackHistory={canViewFeedbackHistory}
              draftConfig={draftConfig}
              liveSurveyQuestions={liveSurveyQuestions}
              surveyResponses={surveyResponses}
              setSurveyResponses={setSurveyResponses}
              bugReport={bugReport}
              setBugReport={setBugReport}
              feedbackSubmissions={feedbackSubmissions}
              submittingFeedback={submittingFeedback}
              onSubmitFeedback={handleSubmitFeedback}
              onAddSurveyQuestion={addSurveyQuestion}
              onUpdateSurveyQuestion={updateSurveyQuestion}
              onRemoveSurveyQuestion={removeSurveyQuestion}
            />
          )}
        </div>
      </div>

      <Modal
        open={isAdmin && showHospitalConfirmModal}
        onClose={closeHospitalConfirmModal}
        width="max-w-lg"
        title="Confirm Hospital Settings Change"
      >
        <div className="px-6 py-6">
          <h3 className="text-lg font-semibold text-slate-950">
            Are you sure you want to change current hospital settings?
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter your administrator password to save changes.
          </p>

          <div className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pending changes</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Metric label="Hospital name" value={hospitalDraftName.trim() || 'Missing'} />
              <Metric label="Slug" value={hospitalDraftSlug.trim().toLowerCase() || 'Missing'} />
            </div>
          </div>

          <div className="mt-5">
            <Field label="Administrator password">
              <input
                className={FIELD_CLASS}
                type="password"
                value={hospitalConfirmPassword}
                onChange={(event) => setHospitalConfirmPassword(event.target.value)}
                placeholder="Enter your current password"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={closeHospitalConfirmModal}
              className="rounded-[16px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSaveHospitalDetails()}
              disabled={savingHospitalDetails}
              className="rounded-[16px] bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingHospitalDetails ? 'Saving Changes…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GeneralSection({
  canEditHospitalDetails,
  user,
  hospitalSummary,
  loadingHospitalSummary,
  isEditingHospitalDetails,
  profileEmail,
  currentPassword,
  newPassword,
  confirmPassword,
  savingProfile,
  hospitalDraftName,
  hospitalDraftSlug,
  setProfileEmail,
  setCurrentPassword,
  setNewPassword,
  setConfirmPassword,
  setHospitalDraftName,
  setHospitalDraftSlug,
  onStartHospitalEdit,
  onCancelHospitalEdit,
  onRequestHospitalSave,
  onSaveProfile,
}: {
  canEditHospitalDetails: boolean;
  user: AuthUser | null;
  hospitalSummary: HospitalSummary | null;
  loadingHospitalSummary: boolean;
  isEditingHospitalDetails: boolean;
  profileEmail: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingProfile: boolean;
  hospitalDraftName: string;
  hospitalDraftSlug: string;
  setProfileEmail: (value: string) => void;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setHospitalDraftName: (value: string) => void;
  setHospitalDraftSlug: (value: string) => void;
  onStartHospitalEdit: () => void;
  onCancelHospitalEdit: () => void;
  onRequestHospitalSave: () => void;
  onSaveProfile: () => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.02fr,0.98fr]">
      <Panel
        title={user?.role === 'ADMIN' ? 'Admin Account Details' : 'Account Details'}
        subtitle="Manage the email and password used to access the hospital dashboard."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email address">
            <input
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              className={FIELD_CLASS}
              type="email"
              placeholder="staff@hospital.ca"
            />
          </Field>
          <Field label="Role">
            <div className={READONLY_CLASS}>{user ? ROLE_LABELS[user.role] : 'Not signed in'}</div>
          </Field>
          <Field label="Current password">
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={FIELD_CLASS}
              type="password"
              placeholder="Required to change password"
            />
          </Field>
          <Field label="New password">
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={FIELD_CLASS}
              type="password"
              placeholder="Minimum 8 characters"
            />
          </Field>
          <Field label="Confirm new password" className="md:col-span-2">
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={FIELD_CLASS}
              type="password"
              placeholder="Repeat the new password"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void onSaveProfile()}
            disabled={savingProfile}
            className="rounded-[16px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? 'Saving Account…' : 'Save Account'}
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Cookie-backed staff session
          </span>
        </div>
      </Panel>

      <Panel
        title="Hospital Details"
        subtitle="Core identity and volume information for the current clinic environment."
      >
        {loadingHospitalSummary ? (
          <EmptyNotice message="Loading hospital information…" />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Metric label="Hospital name" value={hospitalSummary?.name ?? user?.hospital?.name ?? 'Unknown'} />
                <Metric label="Slug" value={hospitalSummary?.slug ?? user?.hospital?.slug ?? 'Unknown'} />
                <Metric label="Hospital ID" value={hospitalSummary?.id ?? user?.hospital?.id ?? 'Unknown'} />
                <Metric label="Accounts" value={hospitalSummary?._count.users ?? 'Unknown'} />
                <Metric label="Total encounters" value={hospitalSummary?._count.encounters ?? 'Unknown'} />
                <Metric label="Signed-in user" value={user?.email ?? 'Unknown'} />
              </div>
              {canEditHospitalDetails && (
                <button
                  onClick={onStartHospitalEdit}
                  className="rounded-[16px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Edit
                </button>
              )}
            </div>

            {canEditHospitalDetails && isEditingHospitalDetails && (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Hospital name">
                    <input
                      className={FIELD_CLASS}
                      type="text"
                      value={hospitalDraftName}
                      onChange={(event) => setHospitalDraftName(event.target.value)}
                      onKeyDown={blurOnEnter}
                      placeholder="Clinic name"
                    />
                  </Field>
                  <Field label="Slug">
                    <input
                      className={FIELD_CLASS}
                      type="text"
                      value={hospitalDraftSlug}
                      onChange={(event) => setHospitalDraftSlug(event.target.value.toLowerCase())}
                      onKeyDown={blurOnEnter}
                      placeholder="clinic-slug"
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  <button
                    onClick={onCancelHospitalEdit}
                    className="rounded-[16px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onRequestHospitalSave}
                    className="rounded-[16px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              This workspace is scoped to a single hospital database. Staff access stays tenant-bound through the
              authenticated hospital account and the server-side hospital ID checks already present in the backend.
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function StaffSection({
  isAdmin,
  canViewRoleDirectory,
  loadingStaffAccounts,
  roleCounts,
  draftConfig,
  draftVisiblePages,
  liveVisiblePages,
  preferredLandingPage,
  setPreferredLandingPageState,
  onSaveLandingPage,
  onTogglePageAccess,
}: {
  isAdmin: boolean;
  canViewRoleDirectory: boolean;
  loadingStaffAccounts: boolean;
  roleCounts: Record<Role, number>;
  draftConfig: HospitalOperationalConfig;
  draftVisiblePages: HospitalPageKey[];
  liveVisiblePages: HospitalPageKey[];
  preferredLandingPage: HospitalPageKey;
  setPreferredLandingPageState: (value: HospitalPageKey) => void;
  onSaveLandingPage: () => void;
  onTogglePageAccess: (role: Role, page: HospitalPageKey) => void;
}) {
  return (
    <div className="space-y-5">
      <Panel
        title="Role-Specific Settings"
        subtitle="Control how the current role experiences the dashboard."
      >
        <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
          <Field label="Preferred landing page">
            <select
              value={preferredLandingPage}
              onChange={(event) => setPreferredLandingPageState(event.target.value as HospitalPageKey)}
              className={FIELD_CLASS}
            >
              {draftVisiblePages.map((view) => (
                <option key={view} value={view}>
                  {PAGE_LABELS[view]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current visible workspaces">
            <div className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5">
              {liveVisiblePages.map((view) => (
                <span key={view} className={PILL_CLASS}>
                  {PAGE_LABELS[view]}
                </span>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={onSaveLandingPage}
            className="rounded-[16px] border border-priage-200 bg-priage-50 px-4 py-2.5 text-sm font-semibold text-priage-700 transition-colors hover:bg-priage-100"
          >
            Save Role Settings
          </button>
          <span className="text-sm text-slate-500">
            The administrator controls which pages can appear here for each role.
          </span>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr]">
        <Panel
          title="Role-Based Workspace Access"
          subtitle={
            isAdmin
              ? 'Choose exactly which workspaces are available for each role. Settings stays available to every role, with content scoped by permissions.'
              : 'This workspace access matrix is managed by your administrator.'
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</th>
                  {HOSPITAL_PAGE_KEYS.map((page) => (
                    <th key={page} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {PAGE_LABELS[page]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_ORDER.map((role) => (
                  <tr key={role} className="rounded-[18px] bg-slate-50">
                    <td className="rounded-l-[18px] px-3 py-3 text-sm font-semibold text-slate-900">{ROLE_LABELS[role]}</td>
                    {HOSPITAL_PAGE_KEYS.map((page) => {
                      const enabled = draftConfig.pageAccess[role].includes(page);
                      return (
                        <td key={`${role}-${page}`} className="px-3 py-3 text-center">
                          <label className="inline-flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={!isAdmin || page === 'settings'}
                              onChange={() => onTogglePageAccess(role, page)}
                              className="h-4 w-4 rounded border-slate-300 text-priage-600 focus:ring-priage-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Role List and Account Counts"
          subtitle="See how many active staff accounts exist in each role."
        >
          {loadingStaffAccounts ? (
            <EmptyNotice message="Loading role counts…" />
          ) : !canViewRoleDirectory ? (
            <EmptyNotice message="Role counts are available to administrators only." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLE_ORDER.map((role) => (
                <Metric
                  key={role}
                  label={ROLE_LABELS[role]}
                  value={roleCounts[role]}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PatientsSection({
  draftConfig,
  onAddIntakeQuestion,
  onUpdateIntakeQuestion,
  onRemoveIntakeQuestion,
}: {
  draftConfig: HospitalOperationalConfig;
  onAddIntakeQuestion: () => void;
  onUpdateIntakeQuestion: (
    id: string,
    field: keyof HospitalCustomIntakeQuestion,
    value: string | boolean,
  ) => void;
  onRemoveIntakeQuestion: (id: string) => void;
}) {
  const requiredCount = draftConfig.customIntakeQuestions.filter((question) => question.required).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr,1.08fr]">
      <Panel
        title="Intake Form Overview"
        subtitle="Review how much custom patient intake content is configured right now."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Custom questions" value={draftConfig.customIntakeQuestions.length} />
          <Metric label="Required questions" value={requiredCount} />
          <Metric
            label="Admittance questions"
            value={draftConfig.customIntakeQuestions.filter((question) => question.appliesTo === 'admit' || question.appliesTo === 'both').length}
          />
          <Metric
            label="Triage questions"
            value={draftConfig.customIntakeQuestions.filter((question) => question.appliesTo === 'triage' || question.appliesTo === 'both').length}
          />
        </div>
        <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          These questions feed the hospital-side completeness review and the patient-facing intake form, so new admin
          questions can be answered directly in-app before arrival.
        </div>
      </Panel>

      <Panel
        title="Intake Form Builder"
        subtitle="Define the prompts that matter most for patient intake and admittance review."
      >
        {draftConfig.customIntakeQuestions.length === 0 ? (
          <EmptyNotice message="No custom intake questions configured yet." />
        ) : (
          <div className="space-y-3">
            {draftConfig.customIntakeQuestions.map((question) => (
              <div key={question.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr,0.8fr,0.8fr,auto]">
                  <Field label="Question label">
                    <input
                      className={FIELD_CLASS}
                      value={question.label}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'label', event.target.value)}
                    />
                  </Field>
                  <Field label="Field key">
                    <input
                      className={FIELD_CLASS}
                      value={question.fieldKey}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'fieldKey', event.target.value)}
                    />
                  </Field>
                  <Field label="Applies to">
                    <select
                      className={FIELD_CLASS}
                      value={question.appliesTo}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'appliesTo', event.target.value)}
                    >
                      <option value="admit">Admittance</option>
                      <option value="triage">Triage</option>
                      <option value="both">Both</option>
                    </select>
                  </Field>
                  <Field label="Response type">
                    <select
                      className={FIELD_CLASS}
                      value={question.responseType}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'responseType', event.target.value)}
                    >
                      {INTAKE_RESPONSE_TYPES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <button
                      onClick={() => onRemoveIntakeQuestion(question.id)}
                      className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,auto]">
                  <Field label="Help text">
                    <textarea
                      className={`${FIELD_CLASS} min-h-[88px] resize-y`}
                      value={question.helpText}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'helpText', event.target.value)}
                    />
                  </Field>
                  <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) => onUpdateIntakeQuestion(question.id, 'required', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-priage-600 focus:ring-priage-500"
                    />
                    Required for completeness
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={onAddIntakeQuestion}
            className="rounded-[16px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add Intake Question
          </button>
        </div>
      </Panel>
    </div>
  );
}

function FeedbackSection({
  isAdmin,
  canViewFeedbackHistory,
  draftConfig,
  liveSurveyQuestions,
  surveyResponses,
  setSurveyResponses,
  bugReport,
  setBugReport,
  feedbackSubmissions,
  submittingFeedback,
  onSubmitFeedback,
  onAddSurveyQuestion,
  onUpdateSurveyQuestion,
  onRemoveSurveyQuestion,
}: {
  isAdmin: boolean;
  canViewFeedbackHistory: boolean;
  draftConfig: HospitalOperationalConfig;
  liveSurveyQuestions: HospitalFeedbackSurveyQuestion[];
  surveyResponses: Record<string, string>;
  setSurveyResponses: Dispatch<SetStateAction<Record<string, string>>>;
  bugReport: string;
  setBugReport: (value: string) => void;
  feedbackSubmissions: HospitalFeedbackSubmission[];
  submittingFeedback: boolean;
  onSubmitFeedback: () => Promise<void>;
  onAddSurveyQuestion: () => void;
  onUpdateSurveyQuestion: (
    id: string,
    field: keyof HospitalFeedbackSurveyQuestion,
    value: string | boolean,
  ) => void;
  onRemoveSurveyQuestion: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {isAdmin && (
        <Panel
          title="Survey Builder"
          subtitle="Define the survey that the admittance team sees on the live feedback page."
        >
          {draftConfig.admittanceFeedbackSurvey.length === 0 ? (
            <EmptyNotice message="No survey questions configured yet." />
          ) : (
            <div className="space-y-3">
              {draftConfig.admittanceFeedbackSurvey.map((question) => (
                <div key={question.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="grid gap-3 lg:grid-cols-[1.3fr,0.8fr,auto]">
                    <Field label="Prompt">
                      <input
                        className={FIELD_CLASS}
                        value={question.prompt}
                        onChange={(event) => onUpdateSurveyQuestion(question.id, 'prompt', event.target.value)}
                      />
                    </Field>
                    <Field label="Response type">
                      <select
                        className={FIELD_CLASS}
                        value={question.responseType}
                        onChange={(event) => onUpdateSurveyQuestion(question.id, 'responseType', event.target.value)}
                      >
                        {SURVEY_RESPONSE_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex items-end">
                      <button
                        onClick={() => onRemoveSurveyQuestion(question.id)}
                        className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,auto]">
                    <Field label="Description">
                      <textarea
                        className={`${FIELD_CLASS} min-h-[76px] resize-y`}
                        value={question.description}
                        onChange={(event) => onUpdateSurveyQuestion(question.id, 'description', event.target.value)}
                      />
                    </Field>
                    <label className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) => onUpdateSurveyQuestion(question.id, 'required', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-priage-600 focus:ring-priage-500"
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={onAddSurveyQuestion}
              className="rounded-[16px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Add Survey Question
            </button>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.02fr,0.98fr]">
        <Panel
          title="Live Survey and Bug Report Box"
          subtitle="Submit operational feedback from the admittance desk and capture issues that need follow-up."
        >
          {liveSurveyQuestions.length === 0 ? (
            <EmptyNotice message="No live survey questions are configured yet, but you can still file a bug report below." />
          ) : (
            <div className="space-y-4">
              {liveSurveyQuestions.map((question) => (
                <div key={question.id}>
                  <label className="block text-sm font-semibold text-slate-800">{question.prompt}</label>
                  {question.description && (
                    <p className="mt-1 text-xs text-slate-500">{question.description}</p>
                  )}

                  {question.responseType === 'scale' ? (
                    <select
                      className={`${FIELD_CLASS} mt-2`}
                      value={surveyResponses[question.id] ?? ''}
                      onChange={(event) => setSurveyResponses((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))}
                    >
                      <option value="">Select a score</option>
                      {[1, 2, 3, 4, 5].map((score) => (
                        <option key={score} value={String(score)}>
                          {score}
                        </option>
                      ))}
                    </select>
                  ) : question.responseType === 'boolean' ? (
                    <select
                      className={`${FIELD_CLASS} mt-2`}
                      value={surveyResponses[question.id] ?? ''}
                      onChange={(event) => setSurveyResponses((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))}
                    >
                      <option value="">Choose one</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <textarea
                      className={`${FIELD_CLASS} mt-2 min-h-[96px] resize-y`}
                      value={surveyResponses[question.id] ?? ''}
                      onChange={(event) => setSurveyResponses((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 pt-5">
            <Field label="Bug report box">
              <textarea
                className={`${FIELD_CLASS} min-h-[140px] resize-y`}
                value={bugReport}
                onChange={(event) => setBugReport(event.target.value)}
                placeholder="Describe workflow bugs, broken states, missing data, or UI issues the team ran into."
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void onSubmitFeedback()}
              disabled={submittingFeedback}
              className="rounded-[16px] bg-priage-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-priage-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingFeedback ? 'Submitting…' : 'Submit Feedback'}
            </button>
            <span className="text-sm text-slate-500">
              Survey answers and bug reports are stored together so admins can review both in one thread of context.
            </span>
          </div>
        </Panel>

        <Panel
          title="Recent Feedback"
          subtitle={
            canViewFeedbackHistory
              ? 'Review recent submissions from clinic staff.'
              : 'Feedback history is visible to administrators and clinical leads.'
          }
        >
          {!canViewFeedbackHistory ? (
            <EmptyNotice message="You can still submit feedback, but only leads can review the shared history." />
          ) : feedbackSubmissions.length === 0 ? (
            <EmptyNotice message="No feedback submissions have been recorded yet." />
          ) : (
            <div className="space-y-3">
              {feedbackSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{submission.submittedBy.email}</div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {submission.submittedBy.role}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(submission.createdAt)}</div>

                  <div className="mt-3 space-y-2">
                    {submission.responses.map((response) => (
                      <div key={`${submission.id}-${response.questionId}`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {response.prompt}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">{String(response.answer)}</div>
                      </div>
                    ))}

                    {submission.bugReport && (
                      <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                          Bug report
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{submission.bugReport}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
      <h2 className="font-hospital-display text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
      {message}
    </div>
  );
}

const FIELD_CLASS =
  'w-full rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.35)] focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200';

const READONLY_CLASS =
  'flex min-h-[46px] items-center rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700';

const PILL_CLASS =
  'inline-flex items-center rounded-full bg-priage-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-priage-700';
