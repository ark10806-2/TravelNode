import { useEffect, useRef, useState } from 'react';
import { Activity, CalendarDays, Check, FileDown, KeyRound, ListChecks, Loader2, LogOut, MapPinned, Pencil, Plane, TicketCheck } from 'lucide-react';
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
  const isCompactRef = useRef(false);
  const [isCompact, setIsCompact] = useState(false);

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

  return (
    <>
      <div ref={introRef} className="border-b border-white/60 bg-background/80 shadow-sm shadow-primary/5 backdrop-blur-xl dark:border-border/70">
        <div className="mx-auto flex w-full max-w-none flex-col gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary)),#ffb454)] text-primary-foreground shadow-sm shadow-primary/30 sm:h-9 sm:w-9">
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold sm:text-base">Japan Trip Planner</div>
              <div className="truncate text-xs text-muted-foreground">Ginza Capital Hotel Moegi 기준 여행 정리</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:flex-nowrap">
              <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
              <Button
                className="flex-1 rounded-full sm:flex-none"
                variant="outline"
                size="sm"
                onClick={onBookletClick}
                disabled={isBookletLoading}
              >
                {isBookletLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                PDF
              </Button>
              <div className="flex flex-1 basis-full gap-1 rounded-full border bg-background p-1 sm:basis-auto sm:flex-none">
                <Button
                  className="flex-1 sm:flex-none"
                  variant={isEditing ? 'default' : 'ghost'}
                  size="sm"
                  onClick={onEditToggle}
                >
                  {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {isEditing ? '완료' : '편집'}
                </Button>
                {isAuthenticated ? (
                  <>
                    <Button className="flex-1 sm:flex-none" variant="ghost" size="sm" onClick={onChangePasswordClick}>
                      <KeyRound className="h-4 w-4" />
                      변경
                    </Button>
                    <Button className="flex-1 sm:flex-none" variant="ghost" size="sm" onClick={onLogout}>
                      <LogOut className="h-4 w-4" />
                      잠금
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 transform-gpu border-b border-white/60 bg-background/80 shadow-sm shadow-primary/5 backdrop-blur-xl will-change-transform dark:border-border/70">
        <div
          className={cn(
            'mx-auto flex w-full max-w-none justify-center px-2 transition-all duration-200 sm:px-4 sm:py-2 lg:px-5',
            isCompact ? 'py-1' : 'py-1.5 sm:py-2'
          )}
        >
          <div className="grid w-full grid-cols-5 gap-1 rounded-full border border-white/70 bg-background/80 p-1 shadow-sm shadow-primary/10 dark:border-border dark:bg-secondary/80 sm:w-[42rem]" role="tablist" aria-label="페이지 전환">
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
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
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
