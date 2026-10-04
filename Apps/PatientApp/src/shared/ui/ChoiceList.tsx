import { Icon } from './Icon';

/** One-of-several answers as large tappable rows. Used by the assessment and the clinic's own questions. */
export function ChoiceList({ name, labelledBy, options, selected, onPick }: {
  name: string; labelledBy: string; options: string[]; selected: string | null; onPick: (choice: string) => void;
}) {
  return (
    <fieldset className="choice-list" aria-labelledby={labelledBy} style={{ border: 0, padding: 0, margin: 0 }}>
      {options.map((choice) => (
        <label key={choice} className="choice">
          <input type="radio" name={name} value={choice} checked={selected === choice} onChange={() => onPick(choice)} />
          <span className="choice__dot"><Icon name="check" size={12} strokeWidth={2.6} /></span>
          <span className="choice__text">{choice}</span>
        </label>
      ))}
    </fieldset>
  );
}
