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
        <p className="toss-eyebrow mb-2 sm:mb-3">Places</p>
        <h1 className="toss-page-title">일정 별 장소</h1>
        <p className="toss-page-description">
          선택한 DAY 동선을 기준으로 가까운 장소 후보를 비교합니다.
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
