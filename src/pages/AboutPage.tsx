import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';
import { useAboutSections } from '@/lib/aboutSections';
import { AboutSectionBlock } from '@/components/AboutSectionsView';
import AdsterraAdSlot from '@/components/AdsterraAdSlot';
import { ArrowLeft, Home, BookOpen, Send, BarChart3 } from 'lucide-react';

interface AboutPageProps {
  navigate: (path: string) => void;
}

export function AboutPage({ navigate }: AboutPageProps) {
  const supportEmail = useSupportEmail();
  const legacy = useEditableOverride('about');
  const { sections, source, loaded } = useAboutSections();

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
          ? sections.filter((s) => s.active).sort((a, b) => a.sort_order - b.sort_order).map((s) => <div key={s.id}><AboutSectionBlock section={s} email={supportEmail} navigate={navigate} /><AdsterraAdSlot className="my-10" /></div>)
          : <div className="h-96 rounded-3xl animate-pulse" style={{ background: 'var(--color-paper)' }} />}
      </div>
    </div>
  );
}
