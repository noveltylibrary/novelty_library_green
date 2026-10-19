import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchEditablePage, PAGE_DEFAULTS } from '@/lib/adminConfig';

export function useEditableOverride(slug: string) {
  const [override, setOverride] = useState<{ title: string; content: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchEditablePage(slug).then((page) => {
      if (alive && page.content.trim() !== PAGE_DEFAULTS[slug]?.content.trim()) setOverride({ title: page.title, content: page.content });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [slug]);
  return override;
}

export function EditablePageOverride({ page, navigate }: { page: { title: string; content: string } | null; navigate: (path: string) => void }): ReactNode {
  if (!page) return null;
  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <article className="surface-card p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-teal-dark)' }}>Novelty Library</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-8" style={{ color: 'var(--color-text)' }}>{page.title}</h1>
          <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: 'var(--color-text)' }}>{page.content}</div>
        </article>
      </div>
    </div>
  );
}
