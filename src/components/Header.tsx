import { ArrowLeft, Menu, X, Shield, Moon, Sun, User, Download, Home, BookOpen, PenTool, Compass, Settings, Bell, LogIn } from 'lucide-react';
import { useState, useEffect, type CSSProperties, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useTheme } from '@/lib/theme';
import logo from '@/assets/logo.png';
import { usePwaInstall } from '@/lib/pwa';
import { useUnreadNotifications } from '@/lib/notifications';
import { useOverlayHistory } from '@/lib/overlayHistory';

interface HeaderProps { navigate: (path: string) => void; currentRoute: string; user: SupabaseUser | null; isAdmin: boolean; }

function NavIcon({ label, icon: Icon, active, onClick, badge, tone }: { label: string; icon: ComponentType<{ className?: string }>; active?: boolean; onClick: () => void; badge?: number; tone?: 'accent'; edge?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`nl-nv ${active ? 'is-active' : ''} ${tone === 'accent' ? 'is-accent' : ''}`}>
    <span className="nl-nv-label">{label}</span>
    <span className="nl-nv-ico"><Icon className="w-[22px] h-[22px]" />{!!badge && badge > 0 && <span className="nl-nv-badge">{badge > 99 ? '99+' : badge}</span>}</span>
  </button>;
}

export function Header({ navigate, currentRoute, user, isAdmin }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useOverlayHistory(menuOpen, () => setMenuOpen(false));
  const { theme, toggleTheme } = useTheme();
  const { canInstall, install } = usePwaInstall();
  const { unreadCount } = useUnreadNotifications();
  const onDarkHero = currentRoute === 'home' && !scrolled && !menuOpen && theme === 'dark';
  const heroInk = onDarkHero ? ({ '--color-text': '#e7fffe', '--color-text-muted': 'rgba(231,255,254,0.72)', '--color-teal-dark': '#5ce1e6', '--color-cyan-dark': '#5ce1e6' } as CSSProperties) : undefined;

  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll); }, []);

  const navItems = [
    { label: 'Home', path: '/', route: 'home', icon: Home },
    { label: 'Reviews', path: '/reviews', route: 'reviews', icon: BookOpen },
    { label: 'Submit', path: '/submit', route: 'submit', icon: PenTool },
    { label: 'Explore', path: '/about', route: 'about', icon: Compass },
  ];
  const handleNav = (path: string) => { navigate(path); setMenuOpen(false); };

const panelItems: { label: string; icon: ComponentType<{ className?: string }>; run: () => void; active?: boolean; badge?: number; accent?: boolean }[] = [
    ...navItems.map((i) => ({ label: i.label, icon: i.icon, run: () => handleNav(i.path), active: currentRoute === i.route })),
    ...(user ? [
      { label: 'Profile', icon: User, run: () => handleNav('/profile'), active: currentRoute === 'profile' },
      { label: 'Accounts', icon: Settings, run: () => handleNav('/account'), active: currentRoute === 'account' },
      { label: 'Notifications', icon: Bell, run: () => handleNav('/notifications'), active: currentRoute === 'notifications', badge: unreadCount },
    ] : [{ label: 'Sign In', icon: LogIn, run: () => handleNav('/auth'), accent: true }]),
    ...(isAdmin ? [{ label: 'Admin Panel', icon: Shield, run: () => handleNav('/admin'), accent: true, active: currentRoute.startsWith('admin') }] : []),
    ...(canInstall ? [{ label: 'Install Web App', icon: Download, run: () => { setMenuOpen(false); void install(); }, accent: true }] : []),
  ];
  const panel = typeof document !== 'undefined' ? createPortal(<div className={`nl-sp-root md:hidden ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
    <div className="nl-sp-scrim" onClick={() => setMenuOpen(false)} />
    <aside className="nl-sp-panel" role="dialog" aria-label="Menu">
      <div className="nl-sp-head"><span className="nl-sp-title">Menu</span><button type="button" className="nl-sp-close" onClick={() => setMenuOpen(false)} aria-label="Close menu" tabIndex={menuOpen ? 0 : -1}><X className="w-5 h-5" /></button></div>
      <nav className="nl-sp-list">
        {panelItems.map((it, i) => <button key={it.label} type="button" tabIndex={menuOpen ? 0 : -1} onClick={it.run} className={`nl-sp-item ${it.active ? 'is-active' : ''} ${it.accent ? 'is-accent' : ''}`} style={{ '--i': i } as CSSProperties}><span className="nl-sp-ico"><it.icon className="w-[18px] h-[18px]" /></span><span className="nl-sp-label">{it.label}</span>{!!it.badge && it.badge > 0 && <span className="nl-sp-badge">{it.badge > 99 ? '99+' : it.badge}</span>}</button>)}
      </nav>
      <div className="nl-sp-foot">Novelty Library</div>
    </aside>
  </div>, document.body) : null;

  const goBack = () => { setMenuOpen(false); if (window.history.length > 1) window.history.back(); else navigate('/'); };
  const isInner = currentRoute !== 'home';
  return <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isInner ? 'nl-hdr-solid' : ''} ${scrolled ? 'backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`} style={{ backgroundColor: scrolled ? 'var(--color-bg)' : 'transparent', opacity: scrolled ? 0.95 : 1 }}>
    <div className="container-prose flex items-center justify-between" style={heroInk}>
      <div className="flex items-center min-w-0">
      {isInner && <button type="button" onClick={goBack} aria-label="Go back" className="md:hidden p-2 -ml-2 mr-1 rounded-lg shrink-0" style={{ color: 'var(--color-text)' }}><ArrowLeft className="w-5 h-5" /></button>}
      <button onClick={() => handleNav('/')} className="flex items-center gap-2.5 group">
        <img src={logo} alt="Novelty Library" className="w-11 h-11 object-contain transition-transform duration-300 group-hover:scale-105" />
        <div className="text-left"><h1 className="font-serif text-xl font-semibold leading-none tracking-tight" style={{ color: 'var(--color-text)' }}>Novelty Library</h1><p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Book Reviews</p></div>
      </button>
      </div>

      <nav className="hidden md:flex items-center gap-0.5" aria-label="Main">
        {navItems.map((item) => <NavIcon key={item.path} label={item.label} icon={item.icon} active={currentRoute === item.route} onClick={() => handleNav(item.path)} />)}
        {user && <>
          <NavIcon label="Profile" icon={User} active={currentRoute === 'profile'} onClick={() => handleNav('/profile')} />
          <NavIcon label="Accounts" icon={Settings} active={currentRoute === 'account'} onClick={() => handleNav('/account')} />
          <NavIcon label="Notifications" icon={Bell} active={currentRoute === 'notifications'} badge={unreadCount} onClick={() => handleNav('/notifications')} />
        </>}
        {isAdmin && <NavIcon label="Admin" icon={Shield} active={currentRoute.startsWith('admin')} tone="accent" onClick={() => handleNav('/admin')} />}
        {!user && <NavIcon label="Sign In" icon={LogIn} active={currentRoute === 'auth'} tone="accent" onClick={() => handleNav('/auth')} />}
        <NavIcon label={theme === 'light' ? 'Dark mode' : 'Light mode'} icon={theme === 'light' ? Moon : Sun} onClick={toggleTheme} />
      </nav>

      <div className="flex md:hidden items-center gap-2"><button onClick={toggleTheme} className="p-2 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>{theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</button><button className="p-2 rounded-lg" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} style={{ color: 'var(--color-text)' }}>{menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button></div>
    </div>

    {panel}
  </header>;
}
