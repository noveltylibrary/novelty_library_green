import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, PenTool, Users, BarChart3, Newspaper, ChevronLeft, ChevronRight } from 'lucide-react';
import { BLOG_URL } from '@/lib/links';

type CardProps = { icon: typeof BookOpen; title: string } & ({ onClick: () => void; href?: undefined } | { href: string; onClick?: undefined });

function NavCard({ icon: Icon, title, onClick, href }: CardProps) {
  const inner = (
    <>
      <span className="home-nav-icon" aria-hidden="true"><Icon /></span>
      <h3 className="home-nav-title">{title}</h3>
    </>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="home-nav-card group" aria-label={`${title} (opens in a new tab)`}>{inner}</a>;
  }
  return <button type="button" onClick={onClick} className="home-nav-card group" aria-label={title}>{inner}</button>;
}

/**
 * Home shortcuts in a swipeable row: four are in view, the fifth (Blog) is one swipe / arrow away.
 * Same layout on phones and desktop; desktop also gets arrow buttons.
 */
export function HomeActionGrid({ navigate }: { navigate: (path: string) => void }) {
  const scroller = useRef<HTMLElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  const go = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: dir === 1 ? el.scrollWidth : 0, behavior: 'smooth' });
  };

  return (
    <div className="home-action-wrap" data-at-start={atStart} data-at-end={atEnd}>
      <section ref={scroller} onScroll={sync} className="home-action-grid" aria-label="Main sections">
        <NavCard icon={BookOpen} title="Reviews" onClick={() => navigate('/reviews')} />
        <NavCard icon={PenTool} title="Submit" onClick={() => navigate('/submit')} />
        <NavCard icon={Users} title="About" onClick={() => navigate('/about')} />
        <NavCard icon={BarChart3} title="Analytics" onClick={() => navigate('/analytics')} />
        <NavCard icon={Newspaper} title="Blog" href={BLOG_URL} />
      </section>
      <div className="home-action-pager">
        <button type="button" className="home-action-arrow" onClick={() => go(-1)} disabled={atStart} aria-label="Show previous shortcuts"><ChevronLeft aria-hidden="true" /></button>
        <div className="home-action-dots" aria-hidden="true"><i className={atStart ? 'is-on' : ''} /><i className={atEnd ? 'is-on' : ''} /></div>
        <button type="button" className="home-action-arrow is-next" onClick={() => go(1)} disabled={atEnd} aria-label="Show more shortcuts"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
  );
}
