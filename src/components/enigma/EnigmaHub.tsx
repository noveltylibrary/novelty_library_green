import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';
import { ChessKnightIcon } from '@/components/ExploreIcons';
import { HangLexIcon, LexiWordIcon } from '@/components/enigma/EnigmaIcons';
import { warmLexiSources } from '@/lib/enigma/lexiPicker';
import type { EnigmaGame } from '@/lib/router';
import type { EnigmaContext } from '@/components/enigma/useEnigmaContext';

interface EnigmaHubProps { onPlay: (game: EnigmaGame) => void; ctx: EnigmaContext }

const GAMES = [
  { id: 'lexiword' as const, name: 'LexiWord', Icon: LexiWordIcon, brief: 'Guess the hidden five-letter word in six tries.' },
  { id: 'hanglex' as const, name: 'HangLex', Icon: HangLexIcon, brief: 'Name the book or author from one trope clue.' },
];

/** Enigma tab landing: two centred game buttons, each an animated mark, the game's name and a one-line brief. */
export function EnigmaHub({ onPlay, ctx }: EnigmaHubProps) {
  const [muted, setMuted] = useState(soundFx.isMuted());
  // Get the first round's sources ready while the reader chooses.
  useEffect(() => { void ctx.getSignals('lexi').then(warmLexiSources).catch(() => undefined); }, [ctx]);
  const toggleSound = () => {
    const next = !muted;
    soundFx.setMuted(next);
    setMuted(next);
    if (!next) soundFx.play('click');
  };
  return (
    <div className="nl-en-hub max-w-4xl mx-auto">
      <header className="nl-en-hub-head animate-fade-up">
        <span className="nl-en-hub-knight"><ChessKnightIcon size={40} /></span>
        <span className="nl-en-kicker">Enigma GameSpace</span>
        <h1>Puzzles for people who love words</h1>
        <p>Short literary games, picked fresh for you every time.</p>
        <button type="button" className="nl-en-sound" onClick={toggleSound} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>
          {muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
        </button>
      </header>
      <div className="nl-en-cards">
        {GAMES.map((g, i) => (
          <button key={g.id} type="button" className="nl-en-card animate-fade-up" style={{ animationDelay: `${80 + i * 80}ms` }} onClick={() => { soundFx.play('click'); onPlay(g.id); }}>
            <span className="nl-en-card-icon"><g.Icon size={76} /></span>
            <span className="nl-en-card-name">{g.name}</span>
            <span className="nl-en-card-blurb">{g.brief}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
