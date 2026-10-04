import { describe, expect, it } from 'vitest';

import { getDeleteAccountConfirmationError } from './deleteAccountConfirmation';

describe('account deletion confirmation', () => {
  it('requires the patient to type their account email and password', () => {
    expect(getDeleteAccountConfirmationError('patient@example.ca', 'patient@example.ca', 'secret', false)).toMatch(/cannot be undone/);
    expect(getDeleteAccountConfirmationError('patient@example.ca', '', 'secret', true)).toMatch(/email yourself/);
    expect(getDeleteAccountConfirmationError('patient@example.ca', 'other@example.ca', 'secret', true)).toMatch(/email yourself/);
    expect(getDeleteAccountConfirmationError('patient@example.ca', 'patient@example.ca', '', true)).toMatch(/password/);
    expect(getDeleteAccountConfirmationError('patient@example.ca', 'PATIENT@example.ca', 'secret', true)).toMatch(/email yourself/);
    expect(getDeleteAccountConfirmationError('patient@example.ca', 'patient@example.ca', 'secret', true)).toBeNull();
  });
});
