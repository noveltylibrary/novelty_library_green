import { go, type EnigmaGame, type ExploreTab } from '@/lib/router';
import { AboutTab } from '@/pages/AboutPage';
import { DiscoveryTab } from '@/components/DiscoveryTab';
import { EnigmaTab } from '@/components/enigma/EnigmaTab';
import { ExploreTabs } from '@/components/ExploreTabs';

export type ExploreTabId = ExploreTab;

interface ExplorePageProps {
  tab: ExploreTab;
  /** Only used by the Enigma tab (/explore/enigma/<game>). */
  game?: EnigmaGame;
  navigate: (path: string) => void;
}

export function ExplorePage({ tab, game, navigate }: ExplorePageProps) {
  // Switching tabs replaces the history entry, so Back leaves Explore instead of bouncing between its tabs.
  const selectTab = (path: string) => go(path, true);

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in nl-about-shell nl-explore">
      <ExploreTabs tab={tab} onSelect={selectTab} />
      <div id="nl-explore-panel" role="tabpanel" aria-labelledby={`nl-explore-tab-${tab}`} key={tab}>
        {tab === 'about' ? <AboutTab navigate={navigate} />
          : tab === 'enigma' ? <EnigmaTab game={game} navigate={navigate} />
          : <DiscoveryTab navigate={navigate} />}
      </div>
    </div>
  );
}
