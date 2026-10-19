import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';
import { useAboutSections } from '@/lib/aboutSections';
import { AboutSectionBlock } from '@/components/AboutSectionsView';
import AdSenseAdSlot from '@/components/AdSenseAdSlot';
import { HowWeRate } from '@/components/HowWeRate';
import { RoadmapTable } from '@/components/RoadmapTable';
import { ArrowLeft, Home, BookOpen, Send, BarChart3, ArrowRight } from 'lucide-react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';

interface AboutPageProps {
  navigate: (path: string) => void;
}

export function AboutPage({ navigate }: AboutPageProps) {
  const supportEmail = useSupportEmail();
  const legacy = useEditableOverride('about');
  const { sections, source, loaded } = useAboutSections();

  // "How we rate" and the roadmap sit right after the "How It Works" section (or at the end if that section was removed).
  const ordered = sections.filter((x) => x.active).sort((x, y) => x.sort_order - y.sort_order);
  const howIdx = ordered.findIndex((x) => x.layout === 'steps' || x.slug === 'how-it-works' || /how it works/i.test(x.title));
  const afterId = ordered.length ? ordered[howIdx >= 0 ? howIdx : ordered.length - 1].id : '';

  // Plain-text copy saved with the old editor still shows, until sections are saved in the new editor.
  if (loaded && source === 'default' && legacy) return <EditablePageOverride page={legacy} navigate={navigate} />;

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in nl-about-shell">
      <nav className="nl-about-mobilenav md:hidden" aria-label="Page navigation">
        <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/'); }} aria-label="Go back"><ArrowLeft aria-hidden="true" /><span>Back</span></button>
        <button type="button" onClick={() => navigate('/')}><Home aria-hidden="true" /><span>Home</span></button>
        <button type="button" onClick={() => navigate('/reviews')}><BookOpen aria-hidden="true" /><span>Reviews</span></button>
        <button type="button" onClick={() => navigate('/submit')}><Send aria-hidden="true" /><span>Submit</span></button>
        <button type="button" onClick={() => navigate('/analytics')}><BarChart3 aria-hidden="true" /><span>Analytics</span></button>
      </nav>
      <div className="max-w-4xl mx-auto" aria-busy={!loaded}>
        {loaded
          ? ordered.map((s) => (
            <div key={s.id}>
              <AboutSectionBlock section={s} email={supportEmail} navigate={navigate} />
              <AdSenseAdSlot className="my-10" />
              {s.id === afterId && (
                <>
                  <HowWeRate navigate={navigate} />
                  <AdSenseAdSlot className="my-12" />
                  <div className="nl-about-roadmap-gap"><RoadmapTable scrollTarget /></div>
                  <section className="nl-about-taste-note" aria-labelledby="nl-about-taste-title">
                    <div className="nl-about-taste-mark"><TasteMatchIcon size={42} /></div>
                    <div className="nl-about-taste-copy">
                      <span className="nl-about-taste-kicker">A more personal way to discover books</span>
                      <h2 id="nl-about-taste-title">Meet Taste Match</h2>
                      <p>Taste Match looks beyond ratings and genres to help you find books that fit your reading mood, preferences, and the qualities you love in a story. Its evolving 40-metric framework considers signals such as pace, atmosphere, writing style, emotional resonance, and cognitive load—so recommendations can reflect <em>your</em> taste, not just what is popular.</p>
                      <button type="button" className="nl-about-taste-button" onClick={() => navigate('/taste-match')}>Explore Taste Match <ArrowRight aria-hidden="true" /></button>
                    </div>
                  </section>
                  <AdSenseAdSlot className="my-10" />
                </>
              )}
            </div>
          ))
          : <div className="h-96 rounded-3xl animate-pulse" style={{ background: 'var(--color-paper)' }} />}
      </div>
    </div>
  );
}
