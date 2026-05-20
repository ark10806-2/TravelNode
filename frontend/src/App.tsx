import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchReservations } from '@/api/reservations';
import { fetchSchedule } from '@/api/schedule';
import { fetchTodos } from '@/api/todos';
import { fetchCategories, fetchPlacePhotos, fetchPlaces } from '@/api/travel';
import { LoginPage } from '@/components/auth/LoginPage';
import { AuthDialog } from '@/components/dialogs/AuthDialog';
import { TripBookletDialog, type TripBookletSnapshot } from '@/components/export/TripBookletDialog';
import { AppTabs } from '@/components/layout/AppTabs';
import { PlacesPage } from '@/components/place/PlacesPage';
import { ReservationPage } from '@/components/reservation/ReservationPage';
import { SchedulePage } from '@/components/schedule/SchedulePage';
import { TodoPage } from '@/components/todo/TodoPage';
import { UsagePage } from '@/components/usage/UsagePage';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useTheme } from '@/hooks/useTheme';
import { useTravelPlaces } from '@/hooks/useTravelPlaces';
import type { AppTab } from '@/types/schedule';
import type { PhotoState, Place } from '@/types/travel';

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
    return <LoginPage onLogin={auth.login} />;
  }

  return <AuthenticatedApp auth={auth} />;
}

function AuthenticatedApp({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const travelPlaces = useTravelPlaces();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = usePersistedState<AppTab>(activeTabStorageKey, 'places', isAppTab);
  const [authDialogMode, setAuthDialogMode] = useState<'change' | null>(null);
  const [bookletSnapshot, setBookletSnapshot] = useState<TripBookletSnapshot | null>(null);
  const [bookletPhotoCache, setBookletPhotoCache] = useState<Record<string, PhotoState>>({});
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
      const [categories, places, scheduleDays, reservations, todos] = await Promise.all([
        fetchCategories(),
        fetchPlaces(),
        fetchSchedule(),
        fetchReservations(),
        fetchTodos()
      ]);
      const nextPhotoCache = await loadBookletPhotos(places, travelPlaces.photoCache);

      setBookletSnapshot({
        generatedAt: new Date().toISOString(),
        categories,
        places,
        scheduleDays,
        reservations,
        todos
      });
      setBookletPhotoCache(nextPhotoCache);
    } catch (bookletError) {
      window.alert(bookletError instanceof Error ? bookletError.message : 'PDF 책자 데이터를 불러오지 못했습니다.');
    } finally {
      setIsBookletLoading(false);
    }
  }

  return (
    <main className="app-background min-h-[100dvh] overflow-x-hidden">
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
      {authDialogMode ? (
        <AuthDialog
          mode={authDialogMode}
          onClose={closeAuthDialog}
          onLogin={auth.login}
          onChangePassword={auth.changePassword}
        />
      ) : null}
      {bookletSnapshot ? (
        <TripBookletDialog
          snapshot={bookletSnapshot}
          photoCache={bookletPhotoCache}
          onClose={() => setBookletSnapshot(null)}
        />
      ) : null}
    </main>
  );
}

function AuthLoadingPage() {
  return (
    <main className="app-background grid min-h-[100dvh] place-items-center">
      <div className="grid justify-items-center gap-3 rounded-2xl border bg-background/90 px-6 py-5 text-sm font-semibold text-muted-foreground shadow-xl shadow-black/10 backdrop-blur">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        세션 확인 중
      </div>
    </main>
  );
}

async function loadBookletPhotos(places: Place[], currentPhotoCache: Record<string, PhotoState>) {
  const nextPhotoCache: Record<string, PhotoState> = { ...currentPhotoCache };
  const missingPlaces = places.filter((place) => {
    const state = nextPhotoCache[place.id];
    return state?.status !== 'ready' || state.photos.length === 0;
  });

  await mapWithConcurrency(missingPlaces, 4, async (place) => {
    try {
      const photos = await fetchPlacePhotos(place.id);
      nextPhotoCache[place.id] = { status: 'ready', photos };
    } catch (error) {
      nextPhotoCache[place.id] = {
        status: 'error',
        photos: nextPhotoCache[place.id]?.photos ?? [],
        error: error instanceof Error ? error.message : '사진을 불러오지 못했습니다.'
      };
    }
  });

  return nextPhotoCache;
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await task(item);
    }
  });

  await Promise.all(workers);
}

export default App;
