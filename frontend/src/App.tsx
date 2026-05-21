import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { downloadTripBookletPdf } from '@/api/booklet';
import { LoginPage } from '@/components/auth/LoginPage';
import { AuthDialog } from '@/components/dialogs/AuthDialog';
import { AppTabs } from '@/components/layout/AppTabs';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { PlacesPage } from '@/components/place/PlacesPage';
import { ReservationPage } from '@/components/reservation/ReservationPage';
import { SchedulePage } from '@/components/schedule/SchedulePage';
import { TodoPage } from '@/components/todo/TodoPage';
import { Button } from '@/components/ui/button';
import { UsagePage } from '@/components/usage/UsagePage';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useTheme } from '@/hooks/useTheme';
import { useTravelPlaces } from '@/hooks/useTravelPlaces';
import type { AppTab } from '@/types/schedule';

const activeTabStorageKey = 'japan-trip-active-tab';

function isAppTab(value: unknown): value is AppTab {
  return value === 'schedule' || value === 'places' || value === 'reservations' || value === 'todo' || value === 'usage';
}

function App() {
  const auth = useAuth();

  if (auth.isCheckingSession) {
    return <AuthLoadingPage />;
  }

  if (!auth.isAuthenticated) {
    return <LoginPage onLogin={auth.login} onPasskeyLogin={auth.loginWithPasskey} />;
  }

  return <AuthenticatedApp auth={auth} />;
}

function AuthenticatedApp({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const travelPlaces = useTravelPlaces();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = usePersistedState<AppTab>(activeTabStorageKey, 'places', isAppTab);
  const [authDialogMode, setAuthDialogMode] = useState<'change' | null>(null);
  const [isBookletLoading, setIsBookletLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  function toggleEditMode() {
    setIsEditing((current) => !current);
  }

  function closeAuthDialog() {
    setAuthDialogMode(null);
  }

  function logout() {
    setIsEditing(false);
    auth.logout();
  }

  async function openTripBooklet() {
    setIsBookletLoading(true);

    try {
      await downloadTripBookletPdf();
    } catch (bookletError) {
      window.alert(bookletError instanceof Error ? bookletError.message : 'PDF를 생성하지 못했습니다.');
    } finally {
      setIsBookletLoading(false);
    }
  }

  return (
    <main className="app-background min-h-[100dvh] overflow-x-clip">
      <PullToRefresh />
      <div>
        <AppTabs
          activeTab={activeTab}
          isAuthenticated={auth.isAuthenticated}
          isEditing={isEditing}
          theme={theme}
          onTabChange={setActiveTab}
          onEditToggle={toggleEditMode}
          onThemeChange={setTheme}
          onBookletClick={openTripBooklet}
          onLogout={logout}
          onChangePasswordClick={() => setAuthDialogMode('change')}
          isBookletLoading={isBookletLoading}
        />
        {travelPlaces.status === 'error' ? (
          <ServerConnectionBanner message={travelPlaces.error} onRetry={() => void travelPlaces.refreshAll()} />
        ) : null}
        {activeTab === 'places' ? (
          <PlacesPage
            travelPlaces={travelPlaces}
            canEdit={auth.isAuthenticated}
            isEditing={isEditing}
            isDarkMode={resolvedTheme === 'dark'}
            onRequireAuth={auth.logout}
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
        {activeTab === 'reservations' ? (
          <ReservationPage
            categories={travelPlaces.categories}
            places={travelPlaces.places}
            canComplete={auth.isAuthenticated}
            isEditing={isEditing}
            photoCache={travelPlaces.photoCache}
            onLoadPhotos={travelPlaces.loadPhotos}
            onRequireAuth={auth.logout}
          />
        ) : null}
        {activeTab === 'todo' ? <TodoPage isEditing={isEditing} /> : null}
        {activeTab === 'usage' ? <UsagePage isEditing={isEditing} /> : null}
        <footer className="mx-auto mt-8 flex w-full max-w-none justify-center px-3 pb-12 pt-8 text-xs font-medium text-muted-foreground/70 sm:px-4 lg:px-5">
          created by eigen.vector
        </footer>
      </div>
      {authDialogMode ? (
        <AuthDialog
          mode={authDialogMode}
          onClose={closeAuthDialog}
          onLogin={auth.login}
          onChangePassword={auth.changePassword}
        />
      ) : null}
    </main>
  );
}

function ServerConnectionBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-3 w-full max-w-none px-3 sm:px-4 lg:px-5">
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50/95 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold">서버 연결이 불안정합니다</div>
            <p className="mt-1 text-xs leading-5 opacity-85">
              일부 화면은 마지막으로 불러온 정보만 표시될 수 있습니다. 서버 상태를 확인한 뒤 다시 시도해주세요.
            </p>
            {message ? <p className="mt-1 truncate text-xs opacity-70">{message}</p> : null}
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </Button>
      </div>
    </div>
  );
}

function AuthLoadingPage() {
  return (
    <main className="app-background grid min-h-[100dvh] place-items-center">
      <div className="toss-card grid justify-items-center gap-3 rounded-3xl px-6 py-5 text-sm font-semibold text-muted-foreground backdrop-blur">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        세션 확인 중
      </div>
    </main>
  );
}

export default App;
