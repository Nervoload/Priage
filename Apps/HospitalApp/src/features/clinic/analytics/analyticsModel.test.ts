import { describe, expect, it } from 'vitest';
import { feedbackTotal, percent, periodWords, sectionLabel, urgencyBar, usefulShare } from './analyticsModel';

describe('analytics model', () => {
  it('shows shares plainly', () => {
    expect(percent(1, 3)).toBe('33%');
    expect(percent(0, 0)).toBe('—');
    expect(usefulShare({ useful: 3, notRight: 1, missing: 9 })).toBe('75%');
    expect(feedbackTotal({ useful: 3, notRight: 1, missing: 2 })).toBe(6);
    expect(periodWords(30)).toBe('the last 30 days');
  });

  it('names sections, falling back to the key', () => {
    expect(sectionLabel('ask_in_room')).toBe('Ask in the room');
    expect(sectionLabel('new_section')).toBe('new section');
  });

  it('builds the urgency bar most urgent first, without empty levels', () => {
    expect(urgencyBar({ clear: 2, caution: 0, escalate: 1, unrated: 1 })).toEqual([
      { key: 'escalate', label: 'Escalate', tone: 'red', count: 1, share: 0.25 },
      { key: 'clear', label: 'Clear', tone: 'green', count: 2, share: 0.5 },
      { key: 'unrated', label: 'Not rated', tone: 'grey', count: 1, share: 0.25 },
    ]);
    expect(urgencyBar({ clear: 0, caution: 0, escalate: 0, unrated: 0 })).toEqual([]);
  });
});
