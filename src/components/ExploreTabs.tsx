import type { KeyboardEvent } from 'react';
import { AboutTabIcon, ChessKnightIcon, ZapIcon } from '@/components/ExploreIcons';
import { soundFx } from '@/lib/soundFx';
import type { ExploreTab } from '@/lib/router';

/** Tab order is left → right. Discovery is the default tab and owns the short address /explore. */
export const EXPLORE_TABS: { id: ExploreTab; label: string; path: string }[] = [
  { id: 'about', label: 'About', path: '/explore/about' },
  { id: 'discovery', label: 'Discovery', path: '/explore' },
  { id: 'enigma', label: 'Enigma', path: '/explore/enigma' },
];

interface ExploreTabsProps {
  tab: ExploreTab;
  onSelect: (path: string) => void;
}

/** The sticky three-way tab bar at the top of Explore (sliding ink pill, keyboard arrows, click sound). */
export function ExploreTabs({ tab, onSelect }: ExploreTabsProps) {
  const select = (id: ExploreTab) => {
    if (id === tab) return;
    const next = EXPLORE_TABS.find((t) => t.id === id);
    if (!next) return;
    soundFx.play('click');
    onSelect(next.path);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = EXPLORE_TABS.findIndex((t) => t.id === tab);
    const n = EXPLORE_TABS.length;
    let nextIndex = index;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % n;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + n) % n;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = n - 1;
    else return;
    e.preventDefault();
    const target = EXPLORE_TABS[nextIndex];
    select(target.id);
    window.requestAnimationFrame(() => document.getElementById(`nl-explore-tab-${target.id}`)?.focus());
  };

  return (
    <div className="nl-explore-sticky">
      <div className="nl-explore-tabs" role="tablist" aria-label="Explore sections" data-active={tab} onKeyDown={onKeyDown}>
        <span className="nl-explore-ink" aria-hidden="true" />
        {EXPLORE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`nl-explore-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="nl-explore-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="nl-explore-tab"
            onClick={() => select(t.id)}
          >
            {t.id === 'about' ? <AboutTabIcon className="nl-explore-tab-ico" /> : null}
            {t.id === 'enigma' ? <ChessKnightIcon className="nl-explore-tab-ico nl-explore-knight" /> : null}
            <span>{t.label}</span>
            {t.id === 'discovery' ? <ZapIcon className="nl-explore-tab-ico nl-explore-zap" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
