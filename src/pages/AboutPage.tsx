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

function TasteMatchExplainer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="nl-about-taste-note" aria-labelledby="nl-about-taste-title">
      <div className="nl-about-taste-mark"><TasteMatchIcon size={42} animate /></div>
      <div className="nl-about-taste-copy">
        <span className="nl-about-taste-kicker">A little taste of how we match</span>
        <h2 id="nl-about-taste-title">Meet Taste Match SE</h2>
        <p>Taste Match SE reads the <em>feel</em> of a book, not just its genre or its stars. Tell it a mood, a few words, or a book you loved, and it brings you the shelves that echo it.</p>
        <button type="button" className="nl-about-taste-button" onClick={() => navigate('/taste-match')}>Explore Taste Match SE <ArrowRight aria-hidden="true" /></button>
      </div>
    </section>
  );
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
  if (loaded && source === 'default' && legacy) return <><EditablePageOverride page={legacy} navigate={navigate} /><div className="container-prose mx-auto pb-12"><TasteMatchExplainer navigate={navigate} /></div></>;

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
                  <TasteMatchExplainer navigate={navigate} />
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
