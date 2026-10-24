import { EnigmaHub } from '@/components/enigma/EnigmaHub';
import { LexiWord } from '@/components/enigma/LexiWord';
import { HangLex } from '@/components/enigma/HangLex';
import { useEnigmaContext } from '@/components/enigma/useEnigmaContext';
import type { EnigmaGame } from '@/lib/router';
import './enigma.css';

interface EnigmaTabProps {
  game?: EnigmaGame;
  navigate: (path: string) => void;
}

/** Explore → Enigma. The hub lives at /explore/enigma; each game has its own address so Back returns to the hub. */
export function EnigmaTab({ game, navigate }: EnigmaTabProps) {
  const ctx = useEnigmaContext();
  const toHub = () => navigate('/explore/enigma');
  return (
    <div className="nl-en">
      {game === 'lexiword' ? <LexiWord onBack={toHub} ctx={ctx} />
        : game === 'hanglex' ? <HangLex onBack={toHub} ctx={ctx} />
        : <EnigmaHub onPlay={(g) => navigate(`/explore/enigma/${g}`)} ctx={ctx} />}
    </div>
  );
}
