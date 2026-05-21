import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ThemeMode } from '@/types/theme';

type ThemeToggleProps = {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
};

const themeOptions = [
  { value: 'light', label: '라이트 모드', icon: Sun },
  { value: 'dark', label: '다크 모드', icon: Moon },
  { value: 'system', label: '시스템 설정', icon: Monitor }
] satisfies { value: ThemeMode; label: string; icon: typeof Sun }[];

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  return (
    <div className="toss-segmented grid shrink-0 grid-cols-3 gap-1" aria-label="테마 설정">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full sm:h-8 sm:w-8 ${isActive ? 'toss-segment-active' : 'text-muted-foreground'}`}
            title={option.label}
            aria-label={option.label}
            aria-pressed={isActive}
            onClick={() => onThemeChange(option.value)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
