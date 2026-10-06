import { BookOpen, PenTool, Users, BarChart3 } from 'lucide-react';

function NavCard({ icon: Icon, title, onClick }: { icon: typeof BookOpen; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="home-nav-card group" aria-label={title}>
      <span className="home-nav-icon" aria-hidden="true"><Icon /></span>
      <h3 className="home-nav-title">{title}</h3>
    </button>
  );
}

/** The four big home shortcuts (one row of 4 on every screen size). */
export function HomeActionGrid({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="home-action-grid" aria-label="Main sections">
      <NavCard icon={BookOpen} title="Reviews" onClick={() => navigate('/reviews')} />
      <NavCard icon={PenTool} title="Submit" onClick={() => navigate('/submit')} />
      <NavCard icon={Users} title="About" onClick={() => navigate('/about')} />
      <NavCard icon={BarChart3} title="Analytics" onClick={() => navigate('/analytics')} />
    </section>
  );
}
