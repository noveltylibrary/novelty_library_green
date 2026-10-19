import { EditablePageOverride } from '@/components/EditablePageOverride';
import { useEffect, useState } from 'react';
import { fetchEditablePage, PAGE_DEFAULTS } from '@/lib/adminConfig';

/** Cookie Policy. Always rendered from the editable page (admin edits override the built-in default). */
export function CookiesPage({ navigate }: { navigate: (path: string) => void }) {
  const [page, setPage] = useState<{ title: string; content: string }>(PAGE_DEFAULTS.cookies);
  useEffect(() => {
    let alive = true;
    fetchEditablePage('cookies').then((p) => { if (alive) setPage({ title: p.title, content: p.content }); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return <EditablePageOverride page={page} navigate={navigate} />;
}
