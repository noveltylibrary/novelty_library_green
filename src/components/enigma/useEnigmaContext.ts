import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserPrefs, fetchContentTraits } from '@/lib/userPrefs';
import { fetchProfileQuestions } from '@/lib/profileQuestions';
import { loadPublished, reviewToSearchBook, useSavedReviews } from '@/lib/readerTools';
import { isCruising, isStruggling, readBehaviour } from '@/lib/enigma/behaviour';
import { buildSignals, type Signals } from '@/lib/enigma/signals';
import { mergeRemote, type EnigmaGameId } from '@/lib/enigma/seenStore';
import type { SearchBook } from '@/lib/rankingSearch';

export interface EnigmaContext {
  readerKey: string;
  signedIn: boolean;
  /** Reads the reader's current signals (device, preferences, profile, history, past rounds). Cheap to call per round. */
  getSignals: (game: EnigmaGameId) => Promise<Signals>;
}

/** Plain text out of the reader's profile answers: strings, shelf entries ({title, author}) and tag lists; reserved `__` keys are skipped. */
function textFromAnswers(answers: Record<string, unknown> | undefined): string[] {
  const out: string[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 3 || out.length > 60) return;
    if (typeof v === 'string') { const t = v.trim(); if (t.length >= 3 && t.length <= 160 && !/^https?:/i.test(t)) out.push(t); }
    else if (Array.isArray(v)) v.forEach((x) => visit(x, depth + 1));
    else if (v && typeof v === 'object') { const o = v as Record<string, unknown>; if (typeof o.title === 'string') visit(o.title, depth + 1); if (typeof o.author === 'string') visit(o.author, depth + 1); }
  };
  Object.entries(answers ?? {}).forEach(([k, v]) => { if (!k.startsWith('__')) visit(v, 0); });
  return out;
}

export function useEnigmaContext(): EnigmaContext {
  const { user, profile } = useAuth();
  const { prefs } = useUserPrefs();
  const saved = useSavedReviews();
  const readerKey = user?.id ?? 'guest';
  const latest = useRef({ user, profile, prefs, savedIds: saved.ids, readerKey });
  latest.current = { user, profile, prefs, savedIds: saved.ids, readerKey };

  // A new device inherits what the account has already seen.
  useEffect(() => { if (user?.id) mergeRemote(user.id, user.user_metadata); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo<EnigmaContext>(() => ({
    readerKey,
    signedIn: !!user,
    async getSignals(game) {
      const { user: u, profile: p, prefs: pr, savedIds, readerKey: key } = latest.current;
      const [published, traits] = await Promise.all([loadPublished().catch(() => []), fetchContentTraits().catch(() => [])]);
      const labelOf = new Map(traits.map((t) => [t.id, t.label] as const));
      const tm = pr.tm; // the reader's Taste Match controls: each source is used only while its switch is on
      const prefLabels = tm.interests ? pr.content.map((id) => labelOf.get(id) ?? id) : [];
      // Profile answers split into reading sections (Book Journey, Reading Identity …) and personal ones (everything else).
      const sectionOf = new Map<string, string>();
      if (tm.profilePersonal || tm.profileReading) (await fetchProfileQuestions(true).catch(() => [])).forEach((q) => sectionOf.set(q.key, q.section));
      const personal: Record<string, unknown> = {}; const reading: Record<string, unknown> = {};
      Object.entries(p?.profile_answers ?? {}).forEach(([k, v]) => { (/book|read/i.test(sectionOf.get(k) ?? '') ? reading : personal)[k] = v; });
      const profileText = [
        ...(tm.profileReading ? [p?.favorite_book, p?.favorite_author, p?.favorite_genre, ...textFromAnswers(reading)] : []),
        ...(tm.profilePersonal ? textFromAnswers(personal) : []),
      ].filter((x): x is string => !!x);
      const catalogue: SearchBook[] = published.map(reviewToSearchBook);
      const mine = new Set(savedIds);
      const history = !tm.reviews ? [] : published.filter((r) => mine.has(r.id) || (!!u && r.user_id === u.id)).map(reviewToSearchBook);
      const b = readBehaviour(key);
      return buildSignals({ readerKey: key, signedIn: !!u, prefLabels, profileText, history, catalogue, allow: { device: tm.device, browser: tm.browser } }, isStruggling(b[game]), isCruising(b[game]));
    },
  }), [readerKey, user]);
}
