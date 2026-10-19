import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AboutLayout = 'hero' | 'pillars' | 'grid' | 'steps' | 'faq' | 'cta' | 'text';

export const ABOUT_LAYOUTS: { value: AboutLayout; label: string; hint: string }[] = [
  { value: 'hero', label: 'Hero (page opening)', hint: 'Badge, big headline and intro paragraph.' },
  { value: 'pillars', label: 'Feature cards (stacked)', hint: 'Large cards with an icon, heading and paragraph.' },
  { value: 'grid', label: 'Small cards (2 columns)', hint: 'Compact icon cards, good for short benefits.' },
  { value: 'steps', label: 'Numbered steps', hint: 'Step 1, 2, 3… with a title and description.' },
  { value: 'faq', label: 'FAQ (open/close)', hint: 'Question = item title, answer = item text. Use {{email}} for the support email.' },
  { value: 'cta', label: 'Call-to-action banner', hint: 'Heading, text and one button.' },
  { value: 'text', label: 'Plain text block', hint: 'Heading plus paragraphs.' },
];

export const ABOUT_ICONS = ['book', 'sparkles', 'heart', 'users', 'globe', 'languages', 'shield', 'library', 'compass', 'wand', 'pen'] as const;
export type AboutIconName = (typeof ABOUT_ICONS)[number];

export interface AboutItem { title: string; desc: string; icon?: string }

export interface AboutSection {
  id: string;
  slug: string;
  layout: AboutLayout;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  items: AboutItem[];
  button_label: string;
  button_link: string;
  sort_order: number;
  active: boolean;
}

export type AboutSectionInput = Partial<Omit<AboutSection, 'id'>> & { id?: string; title: string; layout: AboutLayout };

/** Built-in copy. Shown until an admin saves their own sections (and used by "Load default sections"). */
export const DEFAULT_ABOUT_SECTIONS: AboutSection[] = [
  { id: 'default-hero', slug: 'hero', layout: 'hero', eyebrow: 'Our Story', title: 'What book broke your brain this month?', subtitle: '', body: 'Novelty Library exists so indie readers have a clean, permanent digital shelf that doesn\'t rely on random social feeds. We were tired of typing "books to read" and "best book recommendations" into Google, so we built a home for honest, community-driven book reviews instead.', items: [], button_label: '', button_link: '', sort_order: 10, active: true },
  { id: 'default-about', slug: 'about-novelty', layout: 'pillars', eyebrow: '', title: 'About Novelty Library', subtitle: '', body: '', items: [
    { icon: 'book', title: 'What mission do we serve?', desc: 'Novelty Library Reviews is built specifically so honest reviewers and indie readers have a clean, permanent digital shelf that doesn\'t rely on random social feeds. We want to help more authors and reviewers find their voice in a publicity-driven world, and we\'re glad to give reviewers a hand and a place in Novelty\'s little hopeful journey.' },
    { icon: 'sparkles', title: 'What\'s new on the platform?', desc: 'We run things so you feel visible. The Submit Book Reviews form comes with a live form-progress indicator, light/dark-tone matching, a proper preview step before you post, and Quick-Search-and-Fill — type a book\'s name and the details pull straight from Open Library. Reviewers also get Save-and-Load drafts, a short editing window right after submitting, and an instant downloadable Instagram-story poster — all built to make submitting fast, modern, and genuinely enjoyable.' },
    { icon: 'heart', title: 'Tired of the mediocre?', desc: 'If you\'re tired of typing "books to read" or "best book recommendations" into Google, search no further. Novelty Library brings together book reviews, top recommendations, must-reads, and literary critiques for every kind of reader — fiction, non-fiction, mystery, romance, thrillers, and classics alike. Come for the reviews, stay for the author spotlights and reading guides.' },
  ], button_label: '', button_link: '', sort_order: 20, active: true },
  { id: 'default-why', slug: 'why-share', layout: 'grid', eyebrow: '', title: 'Why Share Your Review?', subtitle: 'Your voice, credited, as it should be.', body: '', items: [
    { icon: 'sparkles', title: 'Spotlight great books & writers', desc: 'Help hidden gems, debut voices, and regional literature get seen beyond mainstream popularity algorithms.' },
    { icon: 'users', title: 'Dedicated reviewer credit', desc: 'Every review carries your name and social handle on its own dedicated, shareable page.' },
    { icon: 'globe', title: 'Reach a growing readership', desc: 'Your thoughts get read across an active, growing reading community with a lot of platform views.' },
    { icon: 'languages', title: 'Multi-language welcome', desc: 'Review in your language of choice — celebrating literature across 10+ regional and international languages.' },
    { icon: 'shield', title: '100% authentic & human', desc: 'A trusted catalog where genuine reader voices matter — no bot-generated summaries, no paid spam.' },
  ], button_label: '', button_link: '', sort_order: 30, active: true },
  { id: 'default-how', slug: 'how-it-works', layout: 'steps', eyebrow: '', title: 'How It Works', subtitle: '', body: '', items: [
    { title: 'Read a book', desc: 'Pick up something that catches your eye. Fiction, non-fiction, poetry — anything goes.' },
    { title: 'Write your take', desc: 'Submit your review through our form. No essays needed — just your honest, two-minute take.' },
    { title: 'Get featured', desc: 'We publish your review to the library and tag you on Instagram. Your take helps other readers discover their next great read.' },
  ], button_label: '', button_link: '', sort_order: 40, active: true },
  { id: 'default-faq', slug: 'faq', layout: 'faq', eyebrow: '', title: 'Frequently Asked Questions', subtitle: 'Can\'t find your answer here? Reach us at {{email}}.', body: '', items: [
    { title: 'What does Novelty Library do?', desc: 'Novelty Library is an open-to-all review submission platform built to make reading more visible and more honest. It aims to close the gap between authors and readers without the paywalls and financial friction that come with a lot of other review channels, so every review is delivered with a real standard of transparency. At heart, it\'s a clean, permanent digital shelf for honest reviewers and indie readers — one that doesn\'t depend on the churn of social feeds, and that treats every reviewer as part of the project rather than just a contributor.' },
    { title: 'Why share your review on Novelty Library?', desc: 'Your voice, credited, as it should be. Sharing here means helping hidden gems, debut authors, and regional literature get seen outside the usual popularity algorithms — and every review lives on its own shareable page with your name and handle front and center. Reviews reach a large, active reading community, can be written in whichever language you\'re most comfortable reviewing in (10+ languages welcome), and the whole catalog stays free of bot-written summaries or paid placements — just real readers, saying what they actually think.' },
    { title: 'How can you review books on Novelty?', desc: 'Just fill out the book review form on the Submit page — that\'s the dedicated Novelty Book Reviews form where every submission starts.' },
  ], button_label: '', button_link: '', sort_order: 50, active: true },
  { id: 'default-cta', slug: 'cta', layout: 'cta', eyebrow: '', title: 'Got a book that hit different?', subtitle: '', body: 'Drop it here. No spam, just vibes — follow for more two-minute book takes that\'ll mess with your head.', items: [], button_label: 'Submit Your Review', button_link: '/submit', sort_order: 60, active: true },
];

function normalize(row: Record<string, unknown>): AboutSection {
  const items = Array.isArray(row.items) ? (row.items as unknown[]).map((x) => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { title: String(o.title ?? ''), desc: String(o.desc ?? ''), icon: typeof o.icon === 'string' ? o.icon : undefined };
  }) : [];
  return {
    id: String(row.id), slug: String(row.slug ?? ''), layout: (ABOUT_LAYOUTS.some((l) => l.value === row.layout) ? row.layout : 'text') as AboutLayout,
    eyebrow: String(row.eyebrow ?? ''), title: String(row.title ?? ''), subtitle: String(row.subtitle ?? ''), body: String(row.body ?? ''),
    items, button_label: String(row.button_label ?? ''), button_link: String(row.button_link ?? ''),
    sort_order: Number(row.sort_order ?? 10), active: row.active !== false,
  };
}

export async function fetchAboutSections(includeInactive = false): Promise<AboutSection[]> {
  let q = supabase.from('about_sections').select('*').order('sort_order', { ascending: true });
  if (!includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function saveAboutSection(input: AboutSectionInput): Promise<AboutSection> {
  if (!input.title.trim()) throw new Error('Section heading is required.');
  const payload = {
    slug: input.slug || `section-${crypto.randomUUID().slice(0, 8)}`,
    layout: input.layout,
    eyebrow: (input.eyebrow ?? '').trim(),
    title: input.title.trim(),
    subtitle: (input.subtitle ?? '').trim(),
    body: input.body ?? '',
    items: (input.items ?? []).filter((i) => i.title.trim() || i.desc.trim()).map((i) => ({ title: i.title.trim(), desc: i.desc.trim(), ...(i.icon ? { icon: i.icon } : {}) })),
    button_label: (input.button_label ?? '').trim(),
    button_link: (input.button_link ?? '').trim(),
    sort_order: input.sort_order ?? 10,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  };
  const q = input.id && !input.id.startsWith('default-')
    ? supabase.from('about_sections').update(payload).eq('id', input.id)
    : supabase.from('about_sections').insert(payload);
  const { data, error } = await q.select('*').single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}

export async function deleteAboutSection(id: string): Promise<void> {
  const { error } = await supabase.from('about_sections').delete().eq('id', id);
  if (error) throw error;
}

/** Copies the built-in About copy into the database so every part of it becomes editable. */
export async function seedDefaultAboutSections(): Promise<void> {
  for (const s of DEFAULT_ABOUT_SECTIONS) {
    await saveAboutSection({ ...s, id: undefined });
  }
}

export function useAboutSections() {
  const [state, setState] = useState<{ sections: AboutSection[]; source: 'db' | 'default'; loaded: boolean }>({ sections: DEFAULT_ABOUT_SECTIONS, source: 'default', loaded: false });
  useEffect(() => {
    let alive = true;
    fetchAboutSections().then((rows) => {
      if (!alive) return;
      setState(rows.length ? { sections: rows, source: 'db', loaded: true } : { sections: DEFAULT_ABOUT_SECTIONS, source: 'default', loaded: true });
    }).catch(() => alive && setState({ sections: DEFAULT_ABOUT_SECTIONS, source: 'default', loaded: true }));
    return () => { alive = false; };
  }, []);
  return state;
}
