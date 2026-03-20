import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 10;
const GUEST_PLACEHOLDER_SECRET = `guest-placeholder:${randomUUID()}`;
let guestPlaceholderPasswordHashPromise: Promise<string> | null = null;

export async function hashPatientPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function buildGuestPlaceholderPasswordHash(): Promise<string> {
  if (!guestPlaceholderPasswordHashPromise) {
    guestPlaceholderPasswordHashPromise = hashPatientPassword(GUEST_PLACEHOLDER_SECRET)
      .catch((error) => {
        guestPlaceholderPasswordHashPromise = null;
        throw error;
      });
  }

  return guestPlaceholderPasswordHashPromise;
}
