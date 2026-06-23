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
        title: 'Priage command center',
        description: 'Priage organizes the emergency department workflow into admittance, triage, waiting-room monitoring, and analytics views.',
        side: 'bottom',
        align: 'center',
      },
      {
        id: 'admittance-queue',
        target: 'hospital.admit.queue',
        view: 'admit',
        title: 'Pre-arrival and admittance queue',
        description: 'Staff can see expected and newly admitted patients early, with intake context available before clinical handoff.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'triage-workspace',
        target: 'hospital.triage.workspace',
        view: 'triage',
        title: 'Triage workspace',
        description: 'Intake context follows the patient into triage so clinicians can prioritize acuity with fewer blind spots.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'waiting-room-monitoring',
        target: 'hospital.waiting.list',
        view: 'waiting',
        title: 'Observable waiting room',
        description: 'Once patients are triaged, the waiting room becomes a live operational surface instead of an invisible queue.',
        side: 'top',
        align: 'center',
      },
      {
        id: 'messaging-alerts',
        target: 'hospital.alerts.banner',
        view: 'waiting',
        title: 'Messaging and escalation',
        description: 'Patient messages, wait-time risk, and alert signals help the team catch deterioration before the next room is ready.',
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
    ],
  },
};

export function getShowcaseTour(tourId: string): ShowcaseTour | null {
  return SHOWCASE_TOURS[tourId] ?? null;
}
