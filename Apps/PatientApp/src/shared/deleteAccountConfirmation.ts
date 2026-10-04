export function getDeleteAccountConfirmationError(
  accountEmail: string,
  enteredEmail: string,
  password: string,
  acknowledged: boolean,
): string | null {
  if (!acknowledged) {
    return 'Confirm that you understand this account deletion cannot be undone.';
  }
  if (!enteredEmail || enteredEmail !== accountEmail) {
    return 'Enter the account email yourself to confirm deletion.';
  }
  if (!password.trim()) {
    return 'Enter your password to confirm account deletion.';
  }
  return null;
}
