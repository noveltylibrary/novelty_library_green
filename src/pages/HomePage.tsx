import { useEffect, useState } from 'react';
import { BookOpen, PenTool, Users, BarChart3 } from 'lucide-react';
import { fetchHomeAnalytics, type HomeAnalytics } from '@/lib/homeAnalytics';
import { HeroSection } from '@/components/HeroSection';
import { AdsterraAdSlot } from '@/components/AdsterraAdSlot';

interface HomePageProps { navigate: (path: string) => void; }

export function HomePage({ navigate }: HomePageProps) {
  const [analytics, setAnalytics] = useState<HomeAnalytics | null>(null);
  useEffect(() => { let alive = true; fetchHomeAnalytics().then((data) => alive && setAnalytics(data)).catch(() => undefined); return () => { alive = false; }; }, []);
  return (
    <div className="pb-20 animate-fade-in">
      <HeroSection navigate={navigate} live={analytics ? { accepted_total: analytics.accepted_total, authors: analytics.authors, avg_form_rating: analytics.avg_form_rating } : null} />
      <div className="container-prose pt-14">
        <AdsterraAdSlot className="my-10 mx-auto" />
        <section className="home-action-grid">
          <NavCard icon={BookOpen} title="Reviews" onClick={() => navigate('/reviews')} />
          <NavCard icon={PenTool} title="Submit" onClick={() => navigate('/submit')} />
          <NavCard icon={Users} title="About" onClick={() => navigate('/about')} />
          <NavCard icon={BarChart3} title="Analytics" onClick={() => navigate('/analytics')} />
        </section>
      </div>
    </div>
  );
}

function NavCard({ icon: Icon, title, onClick }: { icon: typeof BookOpen; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="home-nav-card group" aria-label={title}>
      <span className="home-nav-icon" aria-hidden="true"><Icon /></span>
      <h3 className="home-nav-title">{title}</h3>
    </button>
  );
}
