import { useEffect, useState } from 'react';
import { BookOpen, PenTool, Users, BarChart3, ArrowRight } from 'lucide-react';
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
          <NavCard icon={BookOpen} title="Reviews" desc="Browse the community shelf and open any published take." onClick={() => navigate('/reviews')} />
          <NavCard icon={PenTool} title="Submit" desc="Turn your next read into a Novelty Library review." onClick={() => navigate('/submit')} />
          <NavCard icon={Users} title="About" desc="See how the archive works and what we stand for." onClick={() => navigate('/about')} />
          <NavCard icon={BarChart3} title="Analytics" desc="Explore the live numbers behind the library." onClick={() => navigate('/analytics')} />
        </section>
      </div>
    </div>
  );
}

function NavCard({ icon: Icon, title, desc, onClick }: { icon: typeof BookOpen; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="home-nav-card group">
      <div className="home-nav-icon">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-serif text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-teal-dark)' }}>
        Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}
