import type { ShowcaseTour } from './showcaseTypes';

export const SHOWCASE_TOURS: Record<string, ShowcaseTour> = {
  'hospital-core-demo': {
    id: 'hospital-core-demo',
    label: 'Hospital Staff Demo',
    steps: [
      {
        id: 'command-center',
        target: 'hospital.nav.shell',
        view: 'admit',
        actionId: 'hospital.ensure_showcase_patient',
        title: 'Priage command center',
        description: 'Priage organizes the emergency department workflow into admittance, triage, waiting-room monitoring, and analytics views.',
        side: 'bottom',
        align: 'center',
      },
      {
        id: 'admittance-queue',
        target: 'hospital.admit.queue',
        view: 'admit',
        actionId: 'hospital.admit_showcase_patient',
        title: 'Pre-arrival and admittance queue',
        description: 'A patient-created encounter is now in the queue. Staff can confirm arrival and keep intake context attached before clinical handoff.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'triage-workspace',
        target: 'hospital.triage.workspace',
        view: 'triage',
        actionId: 'hospital.triage_showcase_patient',
        title: 'Triage workspace',
        description: 'The same patient moves into triage, where the care team can record acuity and preserve the pre-arrival story.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'waiting-room-monitoring',
        target: 'hospital.waiting.list',
        view: 'waiting',
        actionId: 'hospital.waiting_showcase_patient',
        title: 'Observable waiting room',
        description: 'After triage, the encounter appears in waiting-room operations rather than becoming an invisible queue entry.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'messaging-alerts',
        target: 'hospital.alerts.banner',
        view: 'waiting',
        actionId: 'hospital.patient_worsening_update',
        title: 'Messaging and escalation',
        description: 'A worsening-symptom update from the patient becomes visible to staff, turning the waiting room into an active monitoring surface.',
        side: 'left',
        align: 'center',
      },
      {
        id: 'analytics-overview',
        target: 'hospital.analytics.overview',
        view: 'analytics',
        title: 'Operations analytics',
        description: 'Leadership can see flow, workload, bottlenecks, and waiting-room trends from the same operational data.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'configuration-controls',
        target: 'hospital.settings.controls',
        view: 'settings',
        title: 'Configurable hospital workflows',
        description: 'Administrators can tune patient-facing intake, staff landing pages, and feedback collection around the workflows they actually use.',
        side: 'top',
        align: 'center',
      },
    ],
  },
};

export function getShowcaseTour(tourId: string): ShowcaseTour | null {
  return SHOWCASE_TOURS[tourId] ?? null;
}
