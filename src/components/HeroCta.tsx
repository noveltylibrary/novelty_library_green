import { useRef, type PointerEvent, type ReactNode } from 'react';
import { ArrowUpRight, PenLine } from 'lucide-react';

interface HeroCtaProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  children: ReactNode;
}

/**
 * Home call-to-action pill with a circular "dot" at the end.
 * - primary: teal → cyan gradient, cyan dot with a slowly writing pen
 * - secondary: white pill, teal dot with a north-east arrow
 * On hover the pill grows, a white flash follows the cursor, and the dot's icon turns 45° (arrow → points right, pen → writing pose).
 */
export function HeroCta({ variant, onClick, children }: HeroCtaProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const track = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerMove={track}
      onPointerEnter={track}
      className={`nl-cta nl-cta--${variant}`}
    >
      <span className="nl-cta__flash" aria-hidden="true" />
      <span className="nl-cta__label">{children}</span>
      <span className="nl-cta__dot" aria-hidden="true">
        <span className="nl-cta__icon">
          {variant === 'primary' ? <PenLine strokeWidth={2.4} /> : <ArrowUpRight strokeWidth={2.6} />}
        </span>
      </span>
    </button>
  );
}
