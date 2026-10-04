import { lazy, Suspense, useEffect, useState, Component, type ReactNode } from 'react';
import { useRouter } from '@/lib/router';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { SplashIntro } from '@/components/SplashIntro';
import { HomePage } from '@/pages/HomePage';
import { ReviewsPage } from '@/pages/ReviewsPage';
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
  const [splashComplete, setSplashComplete] = useState(false);

  const currentRouteName = route.name;

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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header navigate={navigate} currentRoute={currentRouteName} user={user} isAdmin={isAdmin} />
      <main className="flex-1">
        {route.name === 'home' && <HomePage navigate={navigate} />}
        {route.name === 'reviews' && <ReviewsPage navigate={navigate} />}
        {route.name === 'analytics' && <AnalyticsPage navigate={navigate} />}
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
        {route.name === 'admin-admins' && <AdminManageAdminsPage navigate={navigate} />}
        {route.name === 'admin-users' && <AdminUsersPage navigate={navigate} />}
        {route.name === 'admin-finances' && <AdminFinancesPage navigate={navigate} />}
        {route.name === 'admin-pages' && <AdminPagesModerationPage navigate={navigate} />}
        {route.name === 'profile' && (route.username ? <PublicProfilePage username={route.username} navigate={navigate} /> : <ProfilePage navigate={navigate} />)}
        {route.name === 'account' && <AccountPage navigate={navigate} />}
        {route.name === 'notifications' && <NotificationsPage navigate={navigate} />}
        {route.name === 'genre' && <ReviewsPage navigate={navigate} />}
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
