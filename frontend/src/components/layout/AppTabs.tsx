import { useEffect, useRef, useState } from 'react';
import { Activity, CalendarDays, Check, FileDown, KeyRound, ListChecks, Loader2, LogOut, MapPinned, Menu, Pencil, TicketCheck, X } from 'lucide-react';
import { AppIcon } from '@/components/common/AppIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppTab } from '@/types/schedule';
import type { ThemeMode } from '@/types/theme';
import { ThemeToggle } from './ThemeToggle';

type AppTabsProps = {
  activeTab: AppTab;
  isAuthenticated: boolean;
  isEditing: boolean;
  theme: ThemeMode;
  onTabChange: (tab: AppTab) => void;
  onEditToggle: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onBookletClick: () => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
  isBookletLoading?: boolean;
};

const tabs = [
  { id: 'places', label: '장소', icon: MapPinned },
  { id: 'schedule', label: '일정', icon: CalendarDays },
  { id: 'reservations', label: '예약', icon: TicketCheck },
  { id: 'todo', label: '할일', icon: ListChecks },
  { id: 'usage', label: '관리', icon: Activity }
] satisfies { id: AppTab; label: string; icon: typeof MapPinned }[];

export function AppTabs({
  activeTab,
  isAuthenticated,
  isEditing,
  theme,
  onTabChange,
  onEditToggle,
  onThemeChange,
  onBookletClick,
  onLogout,
  onChangePasswordClick,
  isBookletLoading
}: AppTabsProps) {
  const introRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isCompactRef = useRef(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let frameId = 0;

    function updateCompactState() {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const threshold = Math.max(24, (introRef.current?.offsetHeight ?? 72) - 12);
        const nextIsCompact = window.scrollY >= threshold;
        if (isCompactRef.current === nextIsCompact) return;

        isCompactRef.current = nextIsCompact;
        setIsCompact(nextIsCompact);
      });
    }

    updateCompactState();
    window.addEventListener('scroll', updateCompactState, { passive: true });
    window.addEventListener('resize', updateCompactState);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', updateCompactState);
      window.removeEventListener('resize', updateCompactState);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <>
      <div ref={introRef} className="toss-header-surface relative z-50 border-b border-border/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <AppIcon className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold sm:text-base">Japan Trip Planner</div>
              <div className="truncate text-xs text-muted-foreground">Ginza Capital Hotel Moegi 기준 여행 정리</div>
            </div>
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            {isMenuOpen ? (
              <div className="toss-card absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl">
                <div className="max-h-[33dvh] overflow-y-auto p-3">
                  <div className="toss-muted-texture flex items-center justify-between gap-3 rounded-2xl p-2.5">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">테마</div>
                      <div className="mt-0.5 text-sm font-semibold">화면 모드</div>
                    </div>
                    <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <MenuActionButton
                      icon={isBookletLoading ? Loader2 : FileDown}
                      label="PDF"
                      disabled={isBookletLoading}
                      spinning={isBookletLoading}
                      onClick={() => {
                        closeMenu();
                        onBookletClick();
                      }}
                    />
                    <MenuActionButton
                      icon={isEditing ? Check : Pencil}
                      label={isEditing ? '완료' : '편집'}
                      active={isEditing}
                      onClick={() => {
                        closeMenu();
                        onEditToggle();
                      }}
                    />
                    {isAuthenticated ? (
                      <>
                        <MenuActionButton
                          icon={KeyRound}
                          label="변경"
                          onClick={() => {
                            closeMenu();
                            onChangePasswordClick();
                          }}
                        />
                        <MenuActionButton
                          icon={LogOut}
                          label="로그아웃"
                          onClick={() => {
                            closeMenu();
                            onLogout();
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 transform-gpu border-b border-border/70 bg-background/90 shadow-[0_1px_2px_rgba(0,27,55,0.04)] backdrop-blur-xl will-change-transform">
        <div
          className={cn(
            'mx-auto flex w-full max-w-none justify-center px-2 transition-all duration-200 sm:px-4 sm:py-2 lg:px-5',
            isCompact ? 'py-1' : 'py-1.5 sm:py-2'
          )}
        >
          <div className="toss-segmented grid w-full grid-cols-5 gap-1 sm:w-[42rem]" role="tablist" aria-label="페이지 전환">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    'inline-flex items-center justify-center rounded-full font-semibold transition-all sm:h-9 sm:gap-2 sm:text-sm',
                    isCompact ? 'h-8 gap-1 text-xs' : 'h-9 gap-2 text-sm',
                    isActive
                      ? 'toss-segment-active'
                      : 'text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-secondary/70'
                  )}
                  onClick={() => onTabChange(tab.id)}
                >
                  <Icon className={cn('transition-all sm:h-4 sm:w-4', isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function MenuActionButton({
  icon: Icon,
  label,
  active,
  disabled,
  spinning,
  onClick
}: {
  icon: typeof FileDown;
  label: string;
  active?: boolean;
  disabled?: boolean;
  spinning?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      className="h-11 rounded-xl px-3"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4', spinning && 'animate-spin')} />
      {label}
    </Button>
  );
}
