import { DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  isEditing: boolean;
  onOpenGoogleMapsSync: () => void;
};

export function AppHeader({
  isEditing,
  onOpenGoogleMapsSync
}: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-3 pb-1 sm:gap-4 sm:pb-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase text-primary sm:mb-3 sm:px-3 sm:text-xs">
          Places
        </p>
        <h1 className="text-2xl font-bold tracking-normal sm:text-5xl">일정 별 장소</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">
          선택한 DAY 동선을 기준으로 가까운 후보를 비교하고 카테고리별 장소를 정리합니다.
        </p>
      </div>
      <div className="grid gap-2 sm:flex sm:items-center">
        {isEditing ? (
          <Button variant="outline" onClick={onOpenGoogleMapsSync}>
            <DownloadCloud className="h-4 w-4" />
            즐겨찾기 가져오기
          </Button>
        ) : null}
      </div>
    </header>
  );
}
