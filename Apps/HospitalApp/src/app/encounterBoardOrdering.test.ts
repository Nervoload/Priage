import { describe, expect, it } from 'vitest';
import { EncounterBoardClock, mergeEncounterSnapshot } from './encounterBoardOrdering';

type Card = { id: number; status: string };

describe('encounter board ordering', () => {
  it('keeps a realtime update that lands before an older snapshot', () => {
    const clock = new EncounterBoardClock();
    const snapshotToken = clock.snapshotRequested();
    const refresh = clock.encounterChanged(42);
    expect(clock.isCurrentRefresh(42, refresh)).toBe(true);
    const board: Card[] = [{ id: 42, status: 'WAITING' }, { id: 7, status: 'ADMITTED' }];

    const merged = mergeEncounterSnapshot<Card>(
      [{ id: 7, status: 'TRIAGE' }, { id: 42, status: 'TRIAGE' }],
      board,
      clock.takeChangedSince(snapshotToken),
    );

    expect(merged).toEqual([{ id: 7, status: 'TRIAGE' }, { id: 42, status: 'WAITING' }]);
  });

  it('keeps an encounter off the board when its newer refresh removed it', () => {
    const clock = new EncounterBoardClock();
    const snapshotToken = clock.snapshotRequested();
    clock.encounterChanged(42);

    const merged = mergeEncounterSnapshot<Card>([{ id: 42, status: 'WAITING' }], [], clock.takeChangedSince(snapshotToken));

    expect(merged).toEqual([]);
  });

  it('keeps an encounter its newer refresh added', () => {
    const clock = new EncounterBoardClock();
    const snapshotToken = clock.snapshotRequested();
    clock.encounterChanged(9);

    const merged = mergeEncounterSnapshot<Card>(
      [{ id: 7, status: 'ADMITTED' }],
      [{ id: 9, status: 'EXPECTED' }],
      clock.takeChangedSince(snapshotToken),
    );

    expect(merged).toEqual([{ id: 7, status: 'ADMITTED' }, { id: 9, status: 'EXPECTED' }]);
  });

  it('lets a snapshot requested after the change replace the board', () => {
    const clock = new EncounterBoardClock();
    clock.encounterChanged(42);
    const snapshotToken = clock.snapshotRequested();

    const changed = clock.takeChangedSince(snapshotToken);
    const merged = mergeEncounterSnapshot<Card>([{ id: 42, status: 'COMPLETE' }], [{ id: 42, status: 'WAITING' }], changed);

    expect(changed.size).toBe(0);
    expect(merged).toEqual([{ id: 42, status: 'COMPLETE' }]);
  });

  it('drops an older refresh once the same encounter changes again', () => {
    const clock = new EncounterBoardClock();
    const first = clock.encounterChanged(42);
    const second = clock.encounterChanged(42);

    expect(clock.isCurrentRefresh(42, first)).toBe(false);
    expect(clock.isCurrentRefresh(42, second)).toBe(true);
  });
});
