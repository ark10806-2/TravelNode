import { Building2, DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Place, TravelModeFilter } from '@/types/travel';

type AppHeaderProps = {
  travelMode: TravelModeFilter;
  onTravelModeChange: (travelMode: TravelModeFilter) => void;
  referencePlace: Place;
  onChangeReference: () => void;
  isEditing: boolean;
  onOpenGoogleMapsSync: () => void;
};

export function AppHeader({
  travelMode,
  onTravelModeChange,
  referencePlace,
  onChangeReference,
  isEditing,
  onOpenGoogleMapsSync
}: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-3 pb-1 sm:gap-4 sm:pb-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase text-primary sm:mb-3 sm:px-3 sm:text-xs">
          Places
        </p>
        <h1 className="text-2xl font-bold tracking-normal sm:text-5xl">숙소 근처 장소</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">지도에서 후보를 확인하고 카테고리별로 가까운 장소를 정리합니다.</p>
        <button
          type="button"
          className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onChangeReference}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-muted-foreground">기준점</span>
          <span className="truncate">{referencePlace.name}</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Select value={travelMode} onValueChange={(value) => onTravelModeChange(value as TravelModeFilter)}>
          <SelectTrigger className="col-span-2 w-full sm:w-44">
            <SelectValue placeholder="이동 방식" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="walk">도보</SelectItem>
            <SelectItem value="transit">대중교통</SelectItem>
          </SelectContent>
        </Select>
        <Button className="col-span-2 sm:col-span-1" variant="outline" onClick={onChangeReference}>
          <Building2 className="h-4 w-4" />
          기준점 변경
        </Button>
        {isEditing ? (
          <Button className="col-span-2 sm:col-span-1" variant="outline" onClick={onOpenGoogleMapsSync}>
            <DownloadCloud className="h-4 w-4" />
            즐겨찾기 가져오기
          </Button>
        ) : null}
      </div>
    </header>
  );
}
