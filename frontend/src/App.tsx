import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AuthDialog } from '@/components/dialogs/AuthDialog';
import { AppTabs } from '@/components/layout/AppTabs';
import { PlacesPage } from '@/components/place/PlacesPage';
import { SchedulePage } from '@/components/schedule/SchedulePage';
import { UsagePage } from '@/components/usage/UsagePage';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useTheme } from '@/hooks/useTheme';
import { useTravelPlaces } from '@/hooks/useTravelPlaces';
import type { AppTab } from '@/types/schedule';

const activeTabStorageKey = 'japan-trip-active-tab';
const pullRefreshThreshold = 72;
const pullRefreshMaxDistance = 96;

function isAppTab(value: unknown): value is AppTab {
  return value === 'schedule' || value === 'places' || value === 'usage';
}

function App() {
  const travelPlaces = useTravelPlaces();
  const auth = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = usePersistedState<AppTab>(activeTabStorageKey, 'places', isAppTab);
  const [authDialogMode, setAuthDialogMode] = useState<'login' | 'change' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editAfterLogin, setEditAfterLogin] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated) setIsEditing(false);
  }, [auth.isAuthenticated]);

  useEffect(() => {
    function isMobileViewport() {
      return window.matchMedia('(max-width: 767px)').matches;
    }

    function shouldIgnorePull(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"], iframe'));
    }

    function resetPull() {
      pullStartYRef.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function onTouchStart(event: TouchEvent) {
      if (isPullRefreshing || !isMobileViewport() || window.scrollY > 0 || event.touches.length !== 1) {
        pullStartYRef.current = null;
        return;
      }

      if (shouldIgnorePull(event.target)) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current = event.touches[0].clientY;
    }

    function onTouchMove(event: TouchEvent) {
      const startY = pullStartYRef.current;
      if (startY == null || event.touches.length !== 1) return;

      if (window.scrollY > 0) {
        resetPull();
        return;
      }

      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 0) {
        resetPull();
        return;
      }

      const nextDistance = Math.min(pullRefreshMaxDistance, deltaY * 0.5);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);

      if (deltaY > 8) event.preventDefault();
    }

    function onTouchEnd() {
      if (pullStartYRef.current == null) return;
      const shouldRefresh = pullDistanceRef.current >= pullRefreshThreshold;
      resetPull();

      if (!shouldRefresh) return;
      setIsPullRefreshing(true);
      window.setTimeout(() => window.location.reload(), 140);
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', resetPull);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, [isPullRefreshing]);

  function toggleEditMode() {
    if (isEditing) {
      setIsEditing(false);
      return;
    }

    if (!auth.isAuthenticated) {
      setEditAfterLogin(true);
      setAuthDialogMode('login');
      return;
    }

    setIsEditing(true);
  }

  function closeAuthDialog() {
    if (authDialogMode === 'login') setEditAfterLogin(false);
    setAuthDialogMode(null);
  }

  async function login(password: string) {
    await auth.login(password);
    if (editAfterLogin) {
      setIsEditing(true);
      setEditAfterLogin(false);
    }
  }

  function logout() {
    setIsEditing(false);
    auth.logout();
  }

  return (
    <main className="app-background min-h-[100dvh] overflow-x-hidden">
      <PullRefreshIndicator distance={pullDistance} isRefreshing={isPullRefreshing} />
      <AppTabs
        activeTab={activeTab}
        isAuthenticated={auth.isAuthenticated}
        isEditing={isEditing}
        theme={theme}
        onTabChange={setActiveTab}
        onEditToggle={toggleEditMode}
        onThemeChange={setTheme}
        onLogout={logout}
        onChangePasswordClick={() => setAuthDialogMode('change')}
      />
      {activeTab === 'places' ? (
        <PlacesPage
          travelPlaces={travelPlaces}
          canEdit={auth.isAuthenticated}
          isEditing={isEditing}
          isDarkMode={resolvedTheme === 'dark'}
          onRequireAuth={() => setAuthDialogMode('login')}
        />
      ) : null}
      {activeTab === 'schedule' ? (
        <SchedulePage
          categories={travelPlaces.categories}
          places={travelPlaces.places}
          isEditing={isEditing}
          isDarkMode={resolvedTheme === 'dark'}
          photoCache={travelPlaces.photoCache}
          onLoadPhotos={travelPlaces.loadPhotos}
        />
      ) : null}
      {activeTab === 'usage' ? <UsagePage isEditing={isEditing} /> : null}
      <footer className="mx-auto mt-8 flex w-full max-w-none justify-center px-3 pb-12 pt-8 text-xs font-medium text-muted-foreground/70 sm:px-4 lg:px-5">
        created by eigen.vector
      </footer>
      {authDialogMode ? (
        <AuthDialog
          mode={authDialogMode}
          onClose={closeAuthDialog}
          onLogin={login}
          onChangePassword={auth.changePassword}
        />
      ) : null}
    </main>
  );
}

function PullRefreshIndicator({ distance, isRefreshing }: { distance: number; isRefreshing: boolean }) {
  const isVisible = isRefreshing || distance > 2;
  const progress = Math.min(1, distance / pullRefreshThreshold);
  const translateY = isRefreshing ? 18 : Math.min(30, distance * 0.35);

  if (!isVisible) return null;

  return (
    <div
      className="fixed left-1/2 top-0 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-lg shadow-black/10 backdrop-blur md:hidden"
      style={{ transform: `translate(-50%, ${translateY}px)`, opacity: Math.max(0.55, progress) }}
      aria-live="polite"
    >
      <RefreshCw className={`h-4 w-4 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? '새로고침 중' : progress >= 1 ? '놓으면 새로고침' : '아래로 당겨 새로고침'}
    </div>
  );
}

export default App;
