import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, Globe2, Heart, Languages, Library, ShieldCheck, Star, Trophy, Users, Layers, Filter, Sparkles } from 'lucide-react';
import AdSenseAdSlot from '@/components/AdSenseAdSlot';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { TasteMatchPreview } from '@/components/TasteMatchPreview';
import { RankingsIcon, AnalyticsIcon } from '@/components/ExploreIcons';

interface DiscoveryTabProps {
  navigate: (path: string) => void;
}

type Point = { icon: ReactNode; text: string };

function Points({ items }: { items: Point[] }) {
  return (
    <ul className="nl-disc-points">
      {items.map((p) => <li key={p.text}><span className="nl-disc-point-ico" aria-hidden="true">{p.icon}</span><span>{p.text}</span></li>)}
    </ul>
  );
}

/**
 * Explore → Discovery tab (default). Three engine cards in a fixed order, with an ad block between cards 2 and 3
 * and another at the bottom of the scroll, just above the page footer.
 */
export function DiscoveryTab({ navigate }: DiscoveryTabProps) {
  return (
    <div className="nl-disc max-w-4xl mx-auto">
      <header className="nl-disc-intro animate-fade-up">
        <span className="nl-disc-eyebrow"><Sparkles aria-hidden="true" size={14} /> Discovery</span>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-balance" style={{ color: 'var(--color-text)' }}>Find what is worth reading next</h1>
        <p>Three engines turn what readers say into rankings, trust and taste-aware picks. Each one has its own page. Start here, then jump in.</p>
      </header>

      {/* Card 1 — Live Rankings */}
      <article className="surface-card nl-disc-card animate-fade-up" data-accent="rank" id="discovery-rankings" aria-labelledby="nl-disc-rank-title" style={{ animationDelay: '80ms' }}>
        <header className="nl-disc-head">
          <span className="nl-disc-icon"><RankingsIcon /></span>
          <div className="min-w-0">
            <span className="nl-disc-kicker">Community-driven scoring</span>
            <h2 id="nl-disc-rank-title">Live Rankings</h2>
          </div>
          <span className="nl-disc-num" aria-hidden="true">01</span>
        </header>
        <p className="nl-disc-lede">A leaderboard the community writes, one rating at a time.</p>
        <p className="nl-disc-body">Every published review carries two scores: the reviewer’s own R/W, and an NL score that averages it with every rating readers give. Live Rankings sorts the library by both, so the top of the shelf is decided by readers.</p>
        <Points items={[
          { icon: <Users size={15} />, text: 'Reader ratings move the NL score, so the ranking keeps changing as the community weighs in.' },
          { icon: <Star size={15} />, text: 'R/W stars show the reviewer’s own take, side by side with the NL score.' },
          { icon: <ShieldCheck size={15} />, text: 'Only published, human-written reviews are ranked.' },
        ]} />
        <button type="button" className="nl-disc-jump" onClick={() => navigate('/live-rankings')}><Trophy aria-hidden="true" size={16} /><span>Open Live Rankings</span><ArrowRight aria-hidden="true" size={16} /></button>
      </article>

      {/* Card 2 — Analytics */}
      <article className="surface-card nl-disc-card animate-fade-up" data-accent="stats" id="discovery-analytics" aria-labelledby="nl-disc-stats-title" style={{ animationDelay: '160ms' }}>
        <header className="nl-disc-head">
          <span className="nl-disc-icon"><AnalyticsIcon /></span>
          <div className="min-w-0">
            <span className="nl-disc-kicker">Platform trust &amp; review metrics</span>
            <h2 id="nl-disc-stats-title">Analytics</h2>
          </div>
          <span className="nl-disc-num" aria-hidden="true">02</span>
        </header>
        <p className="nl-disc-lede">See the pulse of the library, in numbers you can check.</p>
        <p className="nl-disc-body">Analytics shows how the library is doing right now: how many reviews are accepted and published, how many languages they span, which review readers love most, and the Trust Score, the average reviewer trust score out of 10.</p>
        <Points items={[
          { icon: <Trophy size={15} />, text: 'Trust Score: the average reviewer trust score, out of 10.' },
          { icon: <Library size={15} />, text: 'Accepted and published review counts, kept current.' },
          { icon: <Languages size={15} />, text: 'The languages the library now covers.' },
          { icon: <Heart size={15} />, text: 'The most-liked review on the shelf.' },
        ]} />
        <button type="button" className="nl-disc-jump" onClick={() => navigate('/analytics')}><BarChart3 aria-hidden="true" size={16} /><span>Open Analytics</span><ArrowRight aria-hidden="true" size={16} /></button>
      </article>

      {/* Ad Block 1 — between Card 2 and Card 3 */}
      <div className="nl-disc-ad" data-slot="discovery-ad-1"><AdSenseAdSlot className="my-10" /></div>

      {/* Card 3 — Taste Match SE */}
      <article className="surface-card nl-disc-card animate-fade-up" data-accent="taste" id="discovery-taste-match" aria-labelledby="nl-disc-taste-title" style={{ animationDelay: '80ms' }}>
        <header className="nl-disc-head">
          <span className="nl-disc-icon nl-disc-icon-taste"><TasteMatchIcon size={46} animate /></span>
          <div className="min-w-0">
            <span className="nl-disc-kicker">Vector matching · personal discovery</span>
            <h2 id="nl-disc-taste-title">Taste Match SE</h2>
          </div>
          <span className="nl-disc-num" aria-hidden="true">03</span>
        </header>
        <p className="nl-disc-lede">Not just what is highly rated. What fits <em>your</em> taste.</p>
        <p className="nl-disc-body">Taste Match SE reads the words, themes and feel of every published review and turns each one into a vector, a kind of fingerprint. Your mood becomes a fingerprint too, and the closest ones win. So a book can match your mood even when it shares none of your keywords.</p>
        <ol className="nl-disc-flow" aria-label="How Taste Match SE works">
          <li><span className="nl-disc-flow-ico" aria-hidden="true"><Sparkles size={15} /></span><b>Mood pills</b><span>Pick up to three moods, describe a read, or name a book you loved.</span></li>
          <li><span className="nl-disc-flow-ico" aria-hidden="true"><Layers size={15} /></span><b>Closest fingerprint</b><span>Each review is scored by how near it sits to your taste.</span></li>
          <li><span className="nl-disc-flow-ico" aria-hidden="true"><Filter size={15} /></span><b>Verdict filters</b><span>Keep only the reads reviewers called Perfection, Go for it or Timepass.</span></li>
        </ol>
        <TasteMatchPreview />
        <button type="button" className="nl-disc-jump" onClick={() => navigate('/taste-match')}><Globe2 aria-hidden="true" size={16} /><span>Explore Taste Match SE</span><ArrowRight aria-hidden="true" size={16} /></button>
      </article>

      {/* Ad Block 2 — bottom of the Discovery scroll, before the page footer */}
      <div className="nl-disc-ad" data-slot="discovery-ad-2"><AdSenseAdSlot className="mt-10 mb-2" /></div>
    </div>
  );
}
