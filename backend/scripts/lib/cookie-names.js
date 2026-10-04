const namespace = process.env.AUTH_COOKIE_NAMESPACE?.trim();
const suffix = namespace ? `_${namespace.replaceAll('-', '_')}` : '';

module.exports = {
  STAFF_AUTH_COOKIE: `priage_staff_auth${suffix}`,
  PATIENT_SESSION_COOKIE: `priage_patient_session${suffix}`,
  CLINIC_ASSESSMENT_COOKIE: `priage_clinic_assessment${suffix}`,
};
