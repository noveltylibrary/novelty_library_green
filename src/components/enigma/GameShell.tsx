import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';

interface GameShellProps {
  title: string;
  tagline: string;
  onBack: () => void;
  children: ReactNode;
}

/** Common frame for an Enigma game: Back to the hub, title, tagline. */
export function GameShell({ title, tagline, onBack, children }: GameShellProps) {
  return (
    <section className="nl-en-game animate-fade-up" aria-label={title}>
      <button type="button" className="nl-en-back" onClick={() => { soundFx.play('click'); onBack(); }}><ArrowLeft size={16} aria-hidden="true" /> Enigma Hub</button>
      <header className="nl-en-game-head">
        <h2>{title}</h2>
        <p>{tagline}</p>
      </header>
      {children}
    </section>
  );
}
