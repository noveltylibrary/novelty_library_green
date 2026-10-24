/** Small animated teal/cyan marks for the Questions tab. The mark is chosen from the wording of the question. */
type Kind = 'book' | 'quill' | 'heart' | 'compass' | 'pin' | 'music' | 'cup' | 'clock' | 'face' | 'spark';

const RULES: Array<[RegExp, Kind]> = [
  [/\b(tea|coffee|drink|food|snack|eat|cook)/i, 'cup'],
  [/\b(write|writing|author|poem|poet|quote|journal)/i, 'quill'],
  [/\b(love|favou?rite|comfort|re-?read|heart|romance|cherish)/i, 'heart'],
  [/\b(genre|explore|next|discover|travel|adventure|journey|dream)/i, 'compass'],
  [/\b(where|place|spot|city|home|setting|corner|room)/i, 'pin'],
  [/\b(music|song|playlist|listen|podcast|audio)/i, 'music'],
  [/\b(when|time|morning|night|habit|daily|routine|pace|hours?)/i, 'clock'],
  [/\b(character|who|person|friend|hero|villain|people)/i, 'face'],
  [/\b(book|read|novel|story|stories|shelf|library|page|chapter)/i, 'book'],
];
export const questionIconKind = (question: string): Kind => RULES.find(([re]) => re.test(question))?.[1] ?? 'spark';

export function QuestionIcon({ question, size = 24 }: { question: string; size?: number }) {
  const kind = questionIconKind(question);
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className: `nl-qi nl-qi-${kind}` };
  switch (kind) {
    case 'book': return <svg {...p}><g className="nl-qi-a"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z" /></g></svg>;
    case 'quill': return <svg {...p}><g className="nl-qi-a"><path d="M20 4c-7 0-12 4-12 10l-3 6M8 14h6M20 4c0 6-4 10-10 10" /></g></svg>;
    case 'heart': return <svg {...p}><path className="nl-qi-b" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
    case 'compass': return <svg {...p}><circle className="nl-qi-d" cx="12" cy="12" r="9" /><path className="nl-qi-a" d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z" /></svg>;
    case 'pin': return <svg {...p}><g className="nl-qi-a"><path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.400 12 21 12 21z" /><circle cx="12" cy="10.500" r="2.200" /></g></svg>;
    case 'music': return <svg {...p}><g className="nl-qi-a"><path d="M9 18V6l10-2v12" /><circle cx="6.500" cy="18" r="2.500" /><circle cx="16.500" cy="16" r="2.500" /></g></svg>;
    case 'cup': return <svg {...p}><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.500a2.500 2.500 0 0 1 0 5H16" /><path className="nl-qi-s" d="M8 3v3M12 3v3" /></svg>;
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9" /><path className="nl-qi-h" d="M12 7v5l3 2" /></svg>;
    case 'face': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.500 14.500c1 1.200 2.100 1.800 3.500 1.800s2.500-.6 3.500-1.800" /><circle className="nl-qi-t" cx="9" cy="10" r=".6" /><circle className="nl-qi-t" cx="15" cy="10" r=".6" /></svg>;
    default: return <svg {...p}><path className="nl-qi-t" d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z" /><path className="nl-qi-t nl-qi-late" d="M19 16l.7 1.800 1.800.7-1.800.7L19 21l-.7-1.800-1.800-.7 1.800-.7z" /></svg>;
  }
}
