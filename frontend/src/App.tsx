import { useEffect, useState } from 'react';
import { AuthDialog } from '@/components/dialogs/AuthDialog';
import { AppTabs } from '@/components/layout/AppTabs';
import { PullRefreshIndicator } from '@/components/layout/PullRefreshIndicator';
import { PlacesPage } from '@/components/place/PlacesPage';
import { SchedulePage } from '@/components/schedule/SchedulePage';
import { TodoPage } from '@/components/todo/TodoPage';
import { UsagePage } from '@/components/usage/UsagePage';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedState } from '@/hooks/usePersistedState';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { useTravelPlaces } from '@/hooks/useTravelPlaces';
import type { AppTab } from '@/types/schedule';

const activeTabStorageKey = 'japan-trip-active-tab';

function isAppTab(value: unknown): value is AppTab {
  return value === 'schedule' || value === 'places' || value === 'todo' || value === 'usage';
}

function App() {
  const travelPlaces = useTravelPlaces();
  const auth = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const pullToRefresh = usePullToRefresh();
  const [activeTab, setActiveTab] = usePersistedState<AppTab>(activeTabStorageKey, 'places', isAppTab);
  const [authDialogMode, setAuthDialogMode] = useState<'login' | 'change' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editAfterLogin, setEditAfterLogin] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated) setIsEditing(false);
  }, [auth.isAuthenticated]);

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
      <PullRefreshIndicator {...pullToRefresh} />
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
      {activeTab === 'todo' ? <TodoPage isEditing={isEditing} /> : null}
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

export default App;
