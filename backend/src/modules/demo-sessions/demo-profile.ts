const DEFAULT_HOSPITAL_DEMO_PROFILE = {
  id: 'default-hospital-demo',
  label: 'Hospital Emergency Department Demo',
  apps: {
    hospital: true,
    patient: false,
  },
  hospitalViews: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
  defaultTourId: 'hospital-core-demo',
  scenarioPack: 'default-ed-shift',
  watermark: 'Demo Data - Not for clinical use',
  disabledCapabilities: [
    'realOutboundMessaging',
    'realIntegrations',
    'productionExports',
    'partnerApiCredentials',
    'unsafeUploads',
    'hospitalConfigMutation',
  ],
} as const;

export type DemoProfile = typeof DEFAULT_HOSPITAL_DEMO_PROFILE;

export function getDemoProfile(profileId: string): DemoProfile {
  if (profileId !== DEFAULT_HOSPITAL_DEMO_PROFILE.id) {
    return DEFAULT_HOSPITAL_DEMO_PROFILE;
  }
  return DEFAULT_HOSPITAL_DEMO_PROFILE;
}
