import { useEffect, useState } from 'react';
import { Plus, X, Clock3, Heart, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchActiveStories, repostStory, toggleStoryLike, type Story } from '@/lib/social';
import { useAuth } from '@/lib/auth';

interface Props { navigate?: (path: string) => void; }

export function StoriesRail({ navigate }: Props) {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<Story | null>(null);
  const [reposting, setReposting] = useState(false);

  const load = () => { if (!user) { setStories([]); return; } fetchActiveStories(user.id).then(setStories).catch(() => setStories([])); };
  useEffect(() => { load(); }, [user?.id]);

  if (!user) return null;
  const groups = stories.reduce<Record<string, Story[]>>((acc, story) => { const key = story.user_id; (acc[key] ||= []).push(story); return acc; }, {});
  const grouped = Object.values(groups).map((g) => [...g].reverse()); // oldest first, like Instagram
  const siblings = active ? (groups[active.user_id] ? [...groups[active.user_id]].reverse() : [active]) : [];
  const activeIdx = active ? Math.max(0, siblings.findIndex((s) => s.id === active.id)) : 0;
  const go = (d: number) => { const n = siblings[activeIdx + d]; if (n) setActive(n); };

  const likeActive = async () => {
    if (!active || !user) return;
    const next = !active.liked_by_me;
    setActive({ ...active, liked_by_me: next, like_count: active.like_count + (next ? 1 : -1) });
    setStories((prev) => prev.map((s) => s.id === active.id ? { ...s, liked_by_me: next, like_count: s.like_count + (next ? 1 : -1) } : s));
    try { await toggleStoryLike(user.id, active.id, !next); } catch { load(); }
  };

  const repost = async () => {
    if (!active || reposting) return;
    setReposting(true);
    try { await repostStory(active.id); setActive({ ...active, reposted_by_me: true }); } finally { setReposting(false); }
  };

  return <>
    <section className="nl-stories" aria-label="Stories">
      <div className="nl-stories-head"><div><span className="nl-eyebrow">24-HOUR STORIES</span><h2>From readers you follow</h2></div>{navigate && <button className="nl-story-add" onClick={() => navigate('/profile')}><Plus className="w-4 h-4" /> Add story</button>}</div>
      <div className="nl-story-scroller">
        {navigate && <button type="button" className="nl-story-bubble nl-story-add-bubble" onClick={() => navigate('/profile')}>
          <span className="nl-story-ring"><span className="nl-story-avatar"><Plus className="w-6 h-6" /></span></span>
          <span className="nl-story-name">Add story</span>
        </button>}
        {grouped.map((group) => { const first = group[0]; return <button key={first.user_id} type="button" className="nl-story-bubble" onClick={() => setActive(first)}><span className="nl-story-ring"><span className="nl-story-avatar">{first.avatar_url ? <img src={first.avatar_url} alt="" /> : <span>{(first.name || first.novelty_username || 'R').slice(0,1).toUpperCase()}</span>}</span></span><span className="nl-story-name">@{first.novelty_username || 'reader'}</span></button>; })}
        {!grouped.length && <span className="nl-story-empty">Follow readers to see their active stories here.</span>}
      </div>
    </section>
    {active && <div className="nl-story-viewer" role="dialog" aria-modal="true" onClick={() => setActive(null)}>
      <div className="nl-story-viewer-card" onClick={(e) => e.stopPropagation()}>
        {siblings.length > 1 && <><div className="nl-story-count">{activeIdx + 1} / {siblings.length}</div>{activeIdx > 0 && <button type="button" className="nl-story-nav nl-story-nav-prev" onClick={() => go(-1)} aria-label="Previous story"><ChevronLeft className="w-5 h-5" /></button>}{activeIdx < siblings.length - 1 && <button type="button" className="nl-story-nav nl-story-nav-next" onClick={() => go(1)} aria-label="Next story"><ChevronRight className="w-5 h-5" /></button>}</>}
        <button className="nl-story-close" onClick={() => setActive(null)} aria-label="Close story"><X className="w-5 h-5" /></button>
        <img src={active.image_url} alt={active.caption || 'Reader story'} />
        <div className="nl-story-viewer-meta"><div className="flex items-center gap-2"><Clock3 className="w-3.5 h-3.5" /> Expires in 24 hours</div><strong>@{active.novelty_username || 'reader'}</strong>{active.caption && <p>{active.caption}</p>}</div>
        <div className="nl-story-actions">
          <button type="button" className={`nl-story-action ${active.liked_by_me ? 'text-rose-300' : ''}`} onClick={() => void likeActive()}><Heart className="w-4 h-4" fill={active.liked_by_me ? 'currentColor' : 'none'} /> {active.like_count}</button>
          <button type="button" className="nl-story-action" disabled={reposting || active.reposted_by_me} onClick={() => void repost()}><Repeat2 className="w-4 h-4" /> {active.reposted_by_me ? 'Reposted' : 'Repost'}</button>
        </div>
      </div>
    </div>}
  </>;
}
