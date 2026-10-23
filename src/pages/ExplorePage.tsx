import type { KeyboardEvent } from 'react';
import { go } from '@/lib/router';
import { AboutTab } from '@/pages/AboutPage';
import { DiscoveryTab } from '@/components/DiscoveryTab';
import { AboutTabIcon, ZapIcon } from '@/components/ExploreIcons';

export type ExploreTabId = 'about' | 'discovery';

interface ExplorePageProps {
  tab: ExploreTabId;
  navigate: (path: string) => void;
}

/** Tab order is left → right. Discovery is the default tab and owns the short address /explore. */
const TABS: { id: ExploreTabId; label: string; path: string }[] = [
  { id: 'about', label: 'About', path: '/explore/about' },
  { id: 'discovery', label: 'Discovery', path: '/explore' },
];

export function ExplorePage({ tab, navigate }: ExplorePageProps) {
  // Switching tabs replaces the history entry, so Back leaves Explore instead of bouncing between its two tabs.
  const select = (id: ExploreTabId) => {
    if (id === tab) return;
    const next = TABS.find((t) => t.id === id);
    if (next) go(next.path, true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') nextIndex = (index + 1) % TABS.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = TABS.length - 1;
    else return;
    e.preventDefault();
    const target = TABS[nextIndex];
    select(target.id);
    window.requestAnimationFrame(() => document.getElementById(`nl-explore-tab-${target.id}`)?.focus());
  };

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in nl-about-shell nl-explore">
      <div className="nl-explore-sticky">
      <div className="nl-explore-tabs" role="tablist" aria-label="Explore sections" data-active={tab} onKeyDown={onKeyDown}>
        <span className="nl-explore-ink" aria-hidden="true" />
        {TABS.map((t) => (
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
            <span>{t.label}</span>
            {t.id === 'discovery' ? <ZapIcon className="nl-explore-tab-ico nl-explore-zap" /> : null}
          </button>
        ))}
      </div>
      </div>

      <div id="nl-explore-panel" role="tabpanel" aria-labelledby={`nl-explore-tab-${tab}`} key={tab}>
        {tab === 'about' ? <AboutTab navigate={navigate} /> : <DiscoveryTab navigate={navigate} />}
      </div>
    </div>
  );
}
