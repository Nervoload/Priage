import { describe, expect, it } from 'vitest';
import type { EncounterSummary } from './types/domain';
import { appendUniqueMessages, chooseMessageEncounter, getLastMessageId } from './messages';
import type { Message } from './types/domain';

function visit(id: number, status: EncounterSummary['status']): EncounterSummary {
  return {
    id,
    status,
    createdAt: '2026-09-26T12:00:00.000Z',
    chiefComplaint: null,
    hospitalId: 1,
    expectedAt: null,
    arrivedAt: null,
  };
}

describe('message thread selection', () => {
  const encounters = [visit(1, 'COMPLETE'), visit(2, 'EXPECTED')];

  it('honours a link to a past visit while another visit is active', () => {
    expect(chooseMessageEncounter(encounters, 1)?.id).toBe(1);
  });

  it('defaults to the active visit when no valid visit is requested', () => {
    expect(chooseMessageEncounter(encounters, null)?.id).toBe(2);
    expect(chooseMessageEncounter(encounters, 999)?.id).toBe(2);
  });

  it('uses previous history when there is no active visit', () => {
    expect(chooseMessageEncounter([visit(1, 'COMPLETE')], null)?.id).toBe(1);
  });
});

it('keeps a sent message visible when an older history request completes afterward', () => {
  const message = (id: number): Message => ({ id } as Message);
  const merged = appendUniqueMessages([message(1), message(2)], [message(3)]);
  expect(merged.map((item) => item.id)).toEqual([1, 2, 3]);
  expect(getLastMessageId(merged)).toBe(3);
  expect(appendUniqueMessages(merged, [message(3)])).toBe(merged);
});
