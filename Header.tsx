import { ArrowLeft, Menu, X, Shield, Moon, Sun, User, Download, Home, BookOpen, Send, Info, Settings, Bell } from 'lucide-react';
import { useState, useEffect, type CSSProperties } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useTheme } from '@/lib/theme';
import logo from '@/assets/logo.png';
import { usePwaInstall } from '@/lib/pwa';
import { useUnreadNotifications } from '@/lib/notifications';

interface HeaderProps { navigate: (path: string) => void; currentRoute: string; user: SupabaseUser | null; isAdmin: boolean; }

export function Header({ navigate, currentRoute, user, isAdmin }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { canInstall, install } = usePwaInstall();
  const { unreadCount } = useUnreadNotifications();
  const onDarkHero = currentRoute === 'home' && !scrolled && !menuOpen && theme === 'dark';
  const heroInk = onDarkHero ? ({ '--color-text': '#e7fffe', '--color-text-muted': 'rgba(231,255,254,0.72)', '--color-teal-dark': '#5ce1e6', '--color-cyan-dark': '#5ce1e6' } as CSSProperties) : undefined;

  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll); }, []);

  const navItems = [
    { label: 'Home', path: '/', route: 'home', icon: Home },
    { label: 'Reviews', path: '/reviews', route: 'reviews', icon: BookOpen },
    { label: 'Submit', path: '/submit', route: 'submit', icon: Send },
    { label: 'About', path: '/about', route: 'about', icon: Info },
  ];
  const handleNav = (path: string) => { navigate(path); setMenuOpen(false); };

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

      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => <button key={item.path} onClick={() => handleNav(item.path)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-300" style={{ color: currentRoute === item.route ? 'var(--color-text)' : 'var(--color-text-muted)', backgroundColor: currentRoute === item.route ? 'rgba(0, 151, 178, 0.08)' : 'transparent' }}><item.icon className="w-3.5 h-3.5" />{item.label}</button>)}
        {user && <>
          <button onClick={() => handleNav('/profile')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all" title="Profile" aria-label="Profile" style={{ color: currentRoute === 'profile' ? 'var(--color-text)' : 'var(--color-text-muted)', backgroundColor: currentRoute === 'profile' ? 'rgba(0, 151, 178, 0.08)' : 'transparent' }}><User className="w-3.5 h-3.5" /> Profile</button>
          <button onClick={() => handleNav('/account')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all" style={{ color: currentRoute === 'account' ? 'var(--color-text)' : 'var(--color-text-muted)', backgroundColor: currentRoute === 'account' ? 'rgba(0, 151, 178, 0.08)' : 'transparent' }}><Settings className="w-3.5 h-3.5" /> Accounts</button>
          <button onClick={() => handleNav('/notifications')} className="relative p-2 rounded-full transition-all" title="Notifications" aria-label="Notifications" style={{ color: currentRoute === 'notifications' ? 'var(--color-text)' : 'var(--color-text-muted)', backgroundColor: currentRoute === 'notifications' ? 'rgba(0, 151, 178, 0.08)' : 'transparent' }}><Bell className="w-4 h-4" />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--color-teal-dark)', color: 'white' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
        </>}
        {isAdmin && <button onClick={() => handleNav('/admin')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all" style={{ color: currentRoute.startsWith('admin') ? 'white' : 'var(--color-teal-dark)', backgroundColor: currentRoute.startsWith('admin') ? 'var(--color-teal-dark)' : 'rgba(0, 151, 178, 0.08)' }}><Shield className="w-3.5 h-3.5" /> Admin</button>}
        {!user && <button onClick={() => handleNav('/auth')} className="px-3.5 py-2 rounded-full text-sm font-medium" style={{ color: 'var(--color-cyan-dark)' }}>Sign In</button>}
        <button onClick={toggleTheme} className="p-2 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)' }}>{theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</button>
      </nav>

      <div className="flex md:hidden items-center gap-2"><button onClick={toggleTheme} className="p-2 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>{theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</button><button className="p-2 rounded-lg" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} style={{ color: 'var(--color-text)' }}>{menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button></div>
    </div>

    {menuOpen && <div className="md:hidden container-prose mt-3 animate-fade-in"><nav className="flex flex-col gap-1 surface-card p-3 shadow-lg">
      {navItems.map((item) => <button key={item.path} onClick={() => handleNav(item.path)} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-left" style={{ color: currentRoute === item.route ? 'var(--color-text)' : 'var(--color-text-muted)', backgroundColor: currentRoute === item.route ? 'rgba(0, 151, 178, 0.08)' : 'transparent' }}><item.icon className="w-4 h-4" />{item.label}</button>)}
      {user && <><button onClick={() => handleNav('/profile')} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-text-muted)' }}><User className="w-4 h-4" /> Profile</button><button onClick={() => handleNav('/account')} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-text-muted)' }}><Settings className="w-4 h-4" /> Accounts</button><button onClick={() => handleNav('/notifications')} className="flex items-center justify-between px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-text-muted)' }}><span className="flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</span>{unreadCount > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--color-teal-dark)', color: 'white' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</button></>}
      {isAdmin && <button onClick={() => handleNav('/admin')} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-teal-dark)' }}><Shield className="w-4 h-4" /> Admin Panel</button>}
      {!user && <button onClick={() => handleNav('/auth')} className="px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-cyan-dark)' }}>Sign In</button>}
      {canInstall && <button onClick={() => { setMenuOpen(false); void install(); }} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-left" style={{ color: 'var(--color-teal-dark)' }}><Download className="w-4 h-4" /> Install Web App</button>}
    </nav></div>}
  </header>;
}
