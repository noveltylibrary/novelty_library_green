import type { SVGProps } from 'react';

/**
 * Animated game marks for the Enigma hub. Colours come from the site's teal and cyan through currentColor and the
 * .nl-en-* classes in enigma.css; motion is plain CSS and is switched off for visitors who prefer reduced motion.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const root = (size: number): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true, focusable: false });

/** LexiWord: a word grid whose first row flips over to reveal a hit, a near miss and a miss. */
export function LexiWordIcon({ size = 72, ...props }: IconProps) {
  const tile = (x: number, y: number, cls: string, letter?: string, delay = 0) => (
    <g key={`${x}-${y}`} className={`nl-ic-tile ${cls}`} style={{ animationDelay: `${delay}ms` }}>
      <rect x={x} y={y} width="16" height="16" rx="3.5" />
      {letter ? <text x={x + 8} y={y + 12} textAnchor="middle">{letter}</text> : null}
    </g>
  );
  return (
    <svg {...root(size)} {...props}>
      {tile(6, 6, 'is-miss', 'L', 0)}
      {tile(24, 6, 'is-near', 'E', 240)}
      {tile(42, 6, 'is-hit', 'X', 480)}
      {tile(6, 24, 'is-hit', 'I', 720)}
      {tile(24, 24, 'is-miss', 'C', 960)}
      {tile(42, 24, 'is-near', 'O', 1200)}
      <g className="nl-ic-blank">
        <rect x="6" y="42" width="16" height="16" rx="3.5" /><rect x="24" y="42" width="16" height="16" rx="3.5" /><rect x="42" y="42" width="16" height="16" rx="3.5" />
        <path className="nl-ic-caret" d="M14 46v8" />
      </g>
    </svg>
  );
}

/** HangLex: a gallows with a single letter tile swinging from it on two short strings, and a row of blanks with one letter showing. */
export function HangLexIcon({ size = 72, ...props }: IconProps) {
  return (
    <svg {...root(size)} {...props}>
      <path className="nl-ic-frame" d="M8 56h26M16 56V6h28M16 15l9-9" />
      <g className="nl-ic-swing">
        <path className="nl-ic-rope" d="M44 6v6M44 12l-6 8M44 12l6 8" />
        <g className="nl-ic-lex">
          <rect x="34" y="20" width="20" height="20" rx="4.5" />
          <text x="44" y="34.5" textAnchor="middle">L</text>
        </g>
      </g>
      <g className="nl-ic-blanks">
        <path d="M30 56h6M39 56h6M48 56h6" />
        <text className="nl-ic-letter" x="42" y="53" textAnchor="middle">A</text>
      </g>
    </svg>
  );
}
