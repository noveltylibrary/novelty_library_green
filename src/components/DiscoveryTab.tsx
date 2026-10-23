import { Fragment, useState, type ReactNode } from 'react';
import { ArrowRight, BarChart3, Globe2, Heart, Languages, Library, ShieldCheck, Star, Trophy, Users, Smile, Fingerprint, Filter, Compass, ChevronLeft, ChevronRight } from 'lucide-react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { TasteMatchPreview } from '@/components/TasteMatchPreview';
import { RankingsIcon, AnalyticsIcon } from '@/components/ExploreIcons';

interface DiscoveryTabProps {
  navigate: (path: string) => void;
}

type Point = { icon: ReactNode; text: string };

const TASTE_STEPS = [
  { title: 'Mood pills', icon: Smile, desc: 'Choose up to three moods, describe the kind of story you want, or name a book you loved. These clues tell Taste Match what you feel like reading right now.' },
  { title: 'Taste fingerprint', icon: Fingerprint, desc: 'Each published review is compared with your preferences using its themes, tone and language—not just matching keywords. The closest fits rise to the top.' },
  { title: 'Verdict funnel', icon: Filter, desc: 'Narrow the suggestions by the reviewer’s verdict: Perfection, Go for it or Timepass. The filter helps you choose the kind of reading experience you want.' },
];

function TasteMatchHowItWorks() {
  const [active, setActive] = useState(0);
  const current = TASTE_STEPS[active];
  const Icon = current.icon;
  return (
    <div className="nl-disc-steps" aria-label="How Taste Match SE works">
      <div className="nl-steps nl-disc-steps-nodes" role="tablist" aria-label="Taste Match SE steps">
        {TASTE_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <Fragment key={step.title}>
              {i > 0 && <span className={`nl-steps-line ${i <= active ? 'is-done' : ''}`} aria-hidden="true" />}
              <button type="button" role="tab" id={`nl-disc-step-tab-${i}`} aria-selected={active === i} aria-controls="nl-disc-step-panel" onClick={() => setActive(i)} className={`nl-steps-node ${active === i ? 'is-on' : ''} ${i < active ? 'is-past' : ''}`}>
                <span className="nl-steps-dot"><StepIcon size={21} aria-hidden="true" /></span>
                <span className="nl-steps-label">{step.title}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <div key={active} id="nl-disc-step-panel" role="tabpanel" aria-labelledby={`nl-disc-step-tab-${active}`} className="surface-card nl-steps-box nl-disc-step-panel animate-fade-up">
        <span className="nl-steps-kicker">STEP {active + 1} OF {TASTE_STEPS.length}</span>
        <div className="nl-disc-step-title"><span className="nl-disc-step-icon"><Icon size={21} aria-hidden="true" /></span><h3>{current.title}</h3></div>
        <p>{current.desc}</p>
        <div className="nl-disc-step-controls">
          <button type="button" onClick={() => setActive((v) => Math.max(0, v - 1))} disabled={active === 0} aria-label="Previous Taste Match step"><ChevronLeft size={16} /> Previous</button>
          <span>{active + 1} / {TASTE_STEPS.length}</span>
          <button type="button" onClick={() => setActive((v) => Math.min(TASTE_STEPS.length - 1, v + 1))} disabled={active === TASTE_STEPS.length - 1} aria-label="Next Taste Match step">Next <ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function Points({ items }: { items: Point[] }) {
  return (
    <ul className="nl-disc-points">
      {items.map((p) => <li key={p.text}><span className="nl-disc-point-ico" aria-hidden="true">{p.icon}</span><span>{p.text}</span></li>)}
    </ul>
  );
}

/**
 * Explore → Discovery tab (default). Interactive discovery tools are ad-free.
 */
export function DiscoveryTab({ navigate }: DiscoveryTabProps) {
  return (
    <div className="nl-disc max-w-4xl mx-auto">
      <header className="nl-disc-intro animate-fade-up">
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-balance" style={{ color: 'var(--color-text)' }}>Find what is worth reading next</h1>
        <p className="nl-disc-summary"><Compass aria-hidden="true" size={19} /><span>Explore the library through reader-powered rankings, transparent review insights and recommendations shaped around your taste.</span></p>
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
        <TasteMatchHowItWorks />
        <TasteMatchPreview />
        <button type="button" className="nl-disc-jump" onClick={() => navigate('/taste-match')}><Globe2 aria-hidden="true" size={16} /><span>Explore Taste Match SE</span><ArrowRight aria-hidden="true" size={16} /></button>
      </article>

    </div>
  );
}
