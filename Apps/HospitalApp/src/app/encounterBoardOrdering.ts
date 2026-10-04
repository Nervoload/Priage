// Ordering rules for the staff encounter board. A list snapshot and the per-encounter
// refreshes triggered by realtime events can resolve in any order; these rules stop an
// older response from undoing newer state.

export class EncounterBoardClock {
  private tick = 0;
  private readonly changedAt = new Map<number, number>();

  /** Records a realtime change to an encounter and returns the token for its refresh. */
  encounterChanged(encounterId: number): number {
    this.tick += 1;
    this.changedAt.set(encounterId, this.tick);
    return this.tick;
  }

  /** False once a newer change to the same encounter, or a newer snapshot, supersedes the refresh. */
  isCurrentRefresh(encounterId: number, token: number): boolean {
    return this.changedAt.get(encounterId) === token;
  }

  /** Returns the token for a list snapshot that is being requested now. */
  snapshotRequested(): number {
    return this.tick;
  }

  /**
   * Returns the encounters that changed after the snapshot was requested. Older changes
   * are forgotten: the snapshot already reflects them.
   */
  takeChangedSince(snapshotToken: number): Set<number> {
    const changed = new Set<number>();
    for (const [encounterId, at] of this.changedAt) {
      if (at > snapshotToken) {
        changed.add(encounterId);
      } else {
        this.changedAt.delete(encounterId);
      }
    }
    return changed;
  }

  reset(): void {
    this.changedAt.clear();
  }
}

/**
 * Applies a list snapshot to the board. Encounters in `changedSinceRequest` keep the board's
 * copy (or stay off the board); their own refresh brings the newer state when it lands.
 */
export function mergeEncounterSnapshot<T extends { id: number }>(
  snapshot: T[],
  current: T[],
  changedSinceRequest: ReadonlySet<number>,
): T[] {
  if (changedSinceRequest.size === 0) return snapshot;

  const currentById = new Map(current.map((encounter) => [encounter.id, encounter]));
  const merged: T[] = [];
  const included = new Set<number>();
  for (const encounter of snapshot) {
    const kept = changedSinceRequest.has(encounter.id) ? currentById.get(encounter.id) : encounter;
    if (kept) {
      merged.push(kept);
      included.add(kept.id);
    }
  }
  for (const encounter of current) {
    if (changedSinceRequest.has(encounter.id) && !included.has(encounter.id)) {
      merged.push(encounter);
    }
  }
  return merged;
}
