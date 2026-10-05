import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';
import { useAboutSections } from '@/lib/aboutSections';
import { AboutSectionBlock } from '@/components/AboutSectionsView';
import AdsterraAdSlot from '@/components/AdsterraAdSlot';

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
      <div className="max-w-4xl mx-auto" aria-busy={!loaded}>
        {loaded
          ? sections.filter((s) => s.active).sort((a, b) => a.sort_order - b.sort_order).map((s) => <div key={s.id}><AboutSectionBlock section={s} email={supportEmail} navigate={navigate} /><AdsterraAdSlot className="my-10" /></div>)
          : <div className="h-96 rounded-3xl animate-pulse" style={{ background: 'var(--color-paper)' }} />}
      </div>
    </div>
  );
}
