import { DownloadCloud, ExternalLink } from 'lucide-react';
import { apiBaseUrl } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TravelModeFilter } from '@/types/travel';

type AppHeaderProps = {
  travelMode: TravelModeFilter;
  onTravelModeChange: (travelMode: TravelModeFilter) => void;
  isEditing: boolean;
  onOpenGoogleMapsSync: () => void;
};

export function AppHeader({ travelMode, onTravelModeChange, isEditing, onOpenGoogleMapsSync }: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase text-primary">
          Places
        </p>
        <h1 className="text-3xl font-bold tracking-normal sm:text-5xl">숙소 근처 장소</h1>
        <p className="mt-3 text-base text-muted-foreground">지도에서 후보를 확인하고 카테고리별로 가까운 장소를 정리합니다.</p>
      </div>
      <div className="grid gap-2 sm:flex sm:items-center">
        <Select value={travelMode} onValueChange={(value) => onTravelModeChange(value as TravelModeFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="이동 방식" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="walk">도보</SelectItem>
            <SelectItem value="transit">대중교통</SelectItem>
          </SelectContent>
        </Select>
        {isEditing ? (
          <Button variant="outline" onClick={onOpenGoogleMapsSync}>
            <DownloadCloud className="h-4 w-4" />
            즐겨찾기 가져오기
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={`${apiBaseUrl}/api/restaurants`} target="_blank" rel="noreferrer">
            API 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </header>
  );
}
