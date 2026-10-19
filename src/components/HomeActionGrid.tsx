import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, PenTool, BarChart3, Trophy, Newspaper, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentType } from 'react';
import { TasteMatchIcon } from '@/components/TasteMatchIcon';
import { BLOG_URL } from '@/lib/links';

type AnimationKey = 'book' | 'write' | 'beat' | 'rise' | 'flip' | 'none';
type CardProps = { icon: ComponentType<{ className?: string }>; title: string; animation: AnimationKey } & ({ onClick: () => void; href?: undefined } | { href: string; onClick?: undefined });

function NavCard({ icon: Icon, title, animation, onClick, href }: CardProps) {
  const cardClassName = `home-nav-card group home-nav-card--${animation}`;
  const inner = (
    <>
      <span className="home-nav-icon" aria-hidden="true"><Icon /></span>
      <h3 className="home-nav-title">{title}</h3>
    </>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cardClassName} aria-label={`${title} (opens in a new tab)`}>{inner}</a>;
  }
  return <button type="button" onClick={onClick} className={cardClassName} aria-label={title}>{inner}</button>;
}

/**
 * Home shortcuts in a swipeable row: four are in view, the last two (Analytics, Blog) are one swipe / arrow away.
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
        <NavCard animation="book" icon={BookOpen} title="Reviews" onClick={() => navigate('/reviews')} />
        <NavCard animation="beat" icon={Trophy} title="Rankings" onClick={() => navigate('/live-rankings')} />
        <NavCard animation="write" icon={PenTool} title="Submit" onClick={() => navigate('/submit')} />
        <NavCard animation="flip" icon={TasteMatchIcon} title="Taste Match" onClick={() => navigate('/taste-match')} />
        <NavCard animation="rise" icon={BarChart3} title="Analytics" onClick={() => navigate('/analytics')} />
        <NavCard animation="none" icon={Newspaper} title="Blog" href={BLOG_URL} />
      </section>
      <div className="home-action-pager">
        <button type="button" className="home-action-arrow" onClick={() => go(-1)} disabled={atStart} aria-label="Show previous shortcuts"><ChevronLeft aria-hidden="true" /></button>
        <div className="home-action-dots" aria-hidden="true"><i className={atStart ? 'is-on' : ''} /><i className={atEnd ? 'is-on' : ''} /></div>
        <button type="button" className="home-action-arrow is-next" onClick={() => go(1)} disabled={atEnd} aria-label="Show more shortcuts"><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
  );
}
