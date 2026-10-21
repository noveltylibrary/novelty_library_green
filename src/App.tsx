import { lazy, Suspense, useEffect, useLayoutEffect, useState, Component, type ReactNode } from 'react';
import { useRouter } from '@/lib/router';
import { useSeo } from '@/lib/seo';
import { warmBlogPosts } from '@/lib/blog';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { SplashIntro } from '@/components/SplashIntro';
import { HomePage } from '@/pages/HomePage';
import { ReviewsPage } from '@/pages/ReviewsPage.tsx';
import { ReviewPage } from '@/pages/ReviewPage';
import { BlogReviewPage } from '@/pages/BlogReviewPage';
import { SubmitPage } from '@/pages/SubmitPage';
import { ReviewGuidelinesPage } from '@/pages/ReviewGuidelinesPage';
import { AboutPage } from '@/pages/AboutPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';
import { CookiesPage } from '@/pages/CookiesPage';
import { CookieBanner } from '@/components/CookieBanner';
import { AuthPage } from '@/pages/AuthPage';
import { AdminHubPage } from '@/pages/AdminHubPage';
import { AdminReviewsPage } from '@/pages/AdminReviewsPage';
import { AdminMasterListPage } from '@/pages/AdminMasterListPage';
import { AdminPostersPage } from '@/pages/AdminPostersPage';
import { AdminBookReviewsPage } from '@/pages/AdminBookReviewsPage';
import { AdminManageAdminsPage } from '@/pages/AdminManageAdminsPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { AccountPage } from '@/pages/AccountPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { LiveRankingsPage } from '@/pages/LiveRankingsPage';
import { TasteMatchPage } from '@/pages/TasteMatchPage';
import { AuthorPage } from '@/pages/AuthorPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { ReviewerPage } from '@/pages/ReviewerPage';
import { GenrePage } from '@/pages/GenrePage';
import { SavedPage } from '@/pages/SavedPage';
import { AdminFinancesPage } from '@/pages/AdminFinancesPage';
import { AdminPagesModerationPage } from '@/pages/AdminPagesModerationPage';
import { AdminReservedBookReviewsPage } from '@/pages/AdminReservedBookReviewsPage';


const OnboardingModal = lazy(() => import('@/components/OnboardingModal').then((module) => ({ default: module.OnboardingModal })));

class OnboardingErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    try { localStorage.setItem('nl_onboarding_dismissed', 'true'); } catch { /* ignore */ }
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function AppContent() {
  const { route, navigate } = useRouter();
  const { user, isAdmin } = useAuth();
  useSeo(route);
  const [splashComplete, setSplashComplete] = useState(false);

  // Load the Blogger archive in the background so "View in Blog" is ready before a review is opened.
  useEffect(() => { warmBlogPosts(); }, []);

  const currentRouteName = route.name;
  const adsRestrictedRoute =
    ['submit', 'account', 'profile', 'auth', 'analytics', 'notifications'].includes(currentRouteName) ||
    currentRouteName.startsWith('admin');

  // Restricted pages must not display ads, including Auto Ads injected while the visitor
  // was on a public route. The attribute also hides any late Google-injected ad markup.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!adsRestrictedRoute) {
      delete root.dataset.nlAdsRestricted;
      return;
    }

    root.dataset.nlAdsRestricted = 'true';
    document
      .querySelectorAll<HTMLScriptElement>('script[data-nl-adsense], script[src*="pagead/js/adsbygoogle.js"]')
      .forEach((script) => script.remove());

    // Clear already-rendered ads from the previous route as well as their loader script.
    document
      .querySelectorAll<HTMLElement>([
        '.adsense-slot',
        'ins.adsbygoogle',
        '.google-auto-placed',
        '[data-google-query-id]',
        '[id*="google_ads_iframe"]',
        'iframe[src*="googlesyndication.com"]',
        'iframe[src*="doubleclick.net"]',
        'iframe[src*="googleadservices.com"]',
      ].join(','))
      .forEach((element) => element.remove());
  }, [adsRestrictedRoute]);

  // After re-verifying with Google from the Account page, return there.
  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem('nl_return_to') === '/account') {
        sessionStorage.removeItem('nl_return_to');
        navigate('/account');
      }
    } catch { /* ignore */ }
  }, [user, navigate]);

  return (
    <div className="nl-app-shell min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <button type="button" className="nl-skip-link" onClick={() => { const m = document.getElementById('main-content'); m?.focus(); m?.scrollIntoView(); }}>Skip to main content</button>
      <Header navigate={navigate} currentRoute={currentRouteName} user={user} isAdmin={isAdmin} />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {route.name === 'home' && <HomePage navigate={navigate} />}
        {route.name === 'reviews' && <ReviewsPage navigate={navigate} />}
        {route.name === 'analytics' && <AnalyticsPage navigate={navigate} />}
        {route.name === 'live-rankings' && <LiveRankingsPage navigate={navigate} />}
        {route.name === 'taste-match' && <TasteMatchPage navigate={navigate} />}
        {route.name === 'review' && <ReviewPage slug={route.slug} navigate={navigate} />}
        {route.name === 'blog-review' && <BlogReviewPage id={route.id} navigate={navigate} />}
        {route.name === 'submit' && <SubmitPage navigate={navigate} />}
        {route.name === 'review-guidelines' && <ReviewGuidelinesPage navigate={navigate} />}
        {route.name === 'about' && <AboutPage navigate={navigate} />}
        {route.name === 'privacy' && <PrivacyPage navigate={navigate} />}
        {route.name === 'terms' && <TermsPage navigate={navigate} />}
        {route.name === 'cookies' && <CookiesPage navigate={navigate} />}
        {route.name === 'auth' && <AuthPage navigate={navigate} />}
        {route.name === 'admin' && <AdminHubPage navigate={navigate} />}
        {route.name === 'admin-reviews' && <AdminReviewsPage navigate={navigate} />}
        {route.name === 'admin-master-list' && <AdminMasterListPage navigate={navigate} />}
        {route.name === 'admin-posters' && <AdminPostersPage navigate={navigate} />}
        {route.name === 'admin-book-reviews' && <AdminBookReviewsPage navigate={navigate} tab={route.tab} />}
        {route.name === 'admin-admins' && <AdminManageAdminsPage navigate={navigate} tab={route.tab} />}
        {route.name === 'admin-users' && <AdminUsersPage navigate={navigate} />}
        {route.name === 'admin-finances' && <AdminFinancesPage navigate={navigate} />}
        {route.name === 'admin-pages' && <AdminPagesModerationPage navigate={navigate} view={route.view} />}
        {route.name === 'profile' && (route.username ? <PublicProfilePage username={route.username} navigate={navigate} /> : <ProfilePage navigate={navigate} />)}
        {route.name === 'account' && <AccountPage navigate={navigate} />}
        {route.name === 'notifications' && <NotificationsPage navigate={navigate} />}
        {route.name === 'author' && <AuthorPage name={route.author} navigate={navigate} />}
        {route.name === 'authors' && <PeoplePage tab="authors" navigate={navigate} />}
        {route.name === 'reviewers' && <PeoplePage tab="reviewers" navigate={navigate} />}
        {route.name === 'reviewer' && <ReviewerPage uid={route.uid} navigate={navigate} />}
        {route.name === 'saved' && <SavedPage navigate={navigate} />}
        {route.name === 'genre' && <GenrePage genre={route.genre} navigate={navigate} />}
        {route.name === 'not-found' && <div className="pt-32 pb-24 container-prose text-center"><h1 className="font-serif text-4xl font-semibold mb-3">Page not found</h1><p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>That page doesn’t exist or has moved.</p><button type="button" className="btn-primary !w-auto" onClick={() => navigate('/')}>Back to Home</button><p className="mt-4"><a href="/reviews" className="underline">Browse all reviews</a></p></div>}
      </main>
      <Footer navigate={navigate} />
      <InstallPrompt />
      <CookieBanner navigate={navigate} />
      <SplashIntro onComplete={() => setSplashComplete(true)} />
      <OnboardingErrorBoundary><Suspense fallback={null}><OnboardingModal splashComplete={splashComplete} navigate={navigate} suppressOnPublicRoute={currentRouteName === 'review-guidelines'} /></Suspense></OnboardingErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
