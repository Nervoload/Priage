import type { KeyboardEvent } from 'react';
import { CopyButton } from '../ui/CopyButton';
import { Dot, cx } from '../ui/controls';
import { GROUPS, isAppointment, patientMeta, rowHint, rowTime, sameSelection, selectionFor, type BoardItem, type Group, type Selection } from './receptionModel';

export function rowKey(item: BoardItem): string {
  const selection = selectionFor(item);
  return `${selection.kind}-${selection.id}`;
}

// One surface, grouped by what Reception does next. Rows, not cards.
export function ReceptionList({ sections, selection, compact, query, onSelect, onMove, onClose }: {
  sections: Array<{ key: Group; rows: BoardItem[] }>;
  selection: Selection | null;
  compact: boolean;
  query: string;
  onSelect: (item: BoardItem) => void;
  onMove: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Escape' && selection) {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white" onKeyDown={onKeyDown}>
      {sections.map((section, index) => {
        const definition = GROUPS.find((group) => group.key === section.key)!;
        return (
          <section key={section.key} aria-labelledby={`reception-group-${section.key}`} className={cx(index > 0 && 'border-t border-line')}>
            <div className="flex items-baseline gap-2 px-5 pb-2 pt-[18px]">
              <h2 id={`reception-group-${section.key}`} className="text-sm font-semibold">{definition.label}</h2>
              <span className="text-sm font-medium tabular-nums text-ink-3">{section.rows.length}</span>
              <span className="flex-1" />
              {!compact && <span className="hidden text-[13px] text-ink-3 md:inline">{definition.note}</span>}
            </div>
            {section.rows.length === 0 ? (
              <p className="border-t border-line px-5 py-3.5 text-sm text-ink-3">{query ? 'No one in this group matches the search.' : definition.empty}</p>
            ) : (
              <ul>
                {section.rows.map((item) => {
                  const selected = sameSelection(item, selection);
                  const time = rowTime(item);
                  const hint = rowHint(item);
                  return (
                    <li key={rowKey(item)} className={cx('group flex items-center border-t border-line transition-colors', selected ? 'bg-brand-select shadow-[inset_3px_0_0_var(--color-brand)]' : 'hover:bg-[#F5F7FA]')}>
                      <button
                        type="button"
                        data-row-key={rowKey(item)}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onSelect(item)}
                        className={cx(
                          'grid min-w-0 flex-1 items-center gap-4 py-3 pl-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
                          compact ? 'grid-cols-[84px_minmax(0,1fr)] pr-3 2xl:grid-cols-[84px_190px_minmax(0,1fr)]' : 'grid-cols-[88px_minmax(0,200px)_minmax(0,1fr)] pr-3 lg:grid-cols-[88px_200px_minmax(0,1fr)_minmax(0,190px)]',
                        )}
                      >
                        <span className="flex flex-col">
                          <span className="font-semibold tabular-nums">{time.time}</span>
                          <span className="text-[13px] text-ink-3">{time.caption}</span>
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{item.row.patientName}</span>
                          <span className="truncate text-[13px] text-ink-3">{patientMeta(item.row.age, item.row.gender)}</span>
                        </span>
                        <span className={cx('truncate text-ink', compact && 'hidden 2xl:block')}>{item.row.chiefComplaint || <span className="text-ink-3">No reason recorded</span>}</span>
                        {!compact && (
                          <span className="hidden min-w-0 items-center justify-end gap-2 text-[13px] font-medium lg:flex">
                            {hint && <><Dot tone={hint.tone} /><span className="truncate text-ink-2">{hint.text}</span></>}
                          </span>
                        )}
                      </button>
                      <span className={cx('w-12 shrink-0 pr-2', !selected && 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100')}>
                        {isAppointment(item) && <CopyButton iconOnly text={item.row.copyText} label={`Copy ${item.row.patientName}’s appointment for PS-SUITE`} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
