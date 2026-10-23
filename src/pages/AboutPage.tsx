import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride } from '@/components/EditablePageOverride';
import { useAboutSections } from '@/lib/aboutSections';
import { AboutSectionBlock } from '@/components/AboutSectionsView';
import { HowWeRate } from '@/components/HowWeRate';
import { RoadmapTable } from '@/components/RoadmapTable';

interface AboutTabProps {
  navigate: (path: string) => void;
}

/**
 * Explore → About tab: the editorial manifesto and platform background. This content page is ad-free.
 * The Rankings, Analytics and Taste Match explanations live in the Discovery tab (see DiscoveryTab).
 * The page frame (top padding, back/home bar, tabs) is provided by ExplorePage.
 */
export function AboutTab({ navigate }: AboutTabProps) {
  const supportEmail = useSupportEmail();
  const legacy = useEditableOverride('about');
  const { sections, source, loaded } = useAboutSections();

  // "How we rate" and the roadmap sit right after the "How It Works" section (or at the end if that section was removed).
  const ordered = sections.filter((x) => x.active).sort((x, y) => x.sort_order - y.sort_order);
  const howIdx = ordered.findIndex((x) => x.layout === 'steps' || x.slug === 'how-it-works' || /how it works/i.test(x.title));
  const afterId = ordered.length ? ordered[howIdx >= 0 ? howIdx : ordered.length - 1].id : '';
  // "Why share your review" moves to sit right below "How we rate".
  const whyRaw = ordered.find((x) => x.slug === 'why-share' || /why share your review/i.test(x.title));
  const why = whyRaw && whyRaw.id !== afterId ? whyRaw : undefined;

  // Plain-text copy saved with the old editor still shows, until sections are saved in the new editor.
  if (loaded && source === 'default' && legacy) {
    return (
      <article className="surface-card p-6 sm:p-10 max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-teal-dark)' }}>Novelty Library</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-8" style={{ color: 'var(--color-text)' }}>{legacy.title}</h1>
        <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: 'var(--color-text)' }}>{legacy.content}</div>
      </article>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" aria-busy={!loaded}>
      {loaded
        ? ordered.filter((s) => s.id !== why?.id).map((s) => (
          <div key={s.id}>
            <AboutSectionBlock section={s} email={supportEmail} navigate={navigate} />
            {s.id === afterId && (
              <>
                <HowWeRate navigate={navigate} />
                {why && <AboutSectionBlock section={why} email={supportEmail} navigate={navigate} />}
                <div className="nl-about-roadmap-gap"><RoadmapTable scrollTarget /></div>
              </>
            )}
          </div>
        ))
        : <div className="h-96 rounded-3xl animate-pulse" style={{ background: 'var(--color-paper)' }} />}
    </div>
  );
}
