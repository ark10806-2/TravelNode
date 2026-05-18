import { useState } from 'react';
import { DownloadCloud, ImageIcon, Loader2, MapPin, Search } from 'lucide-react';
import { previewGoogleMapsList, syncGoogleMapsList } from '@/api/travel';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/constants/travel';
import { getGoogleMapsNoteLabel } from '@/lib/place-utils';
import type { GoogleMapsListPreview, GoogleMapsListPreviewPlace, GoogleMapsListSyncResult } from '@/types/travel';
import { ModalFrame } from './ModalFrame';

type GoogleMapsSyncDialogProps = {
  onClose: () => void;
  onSynced: () => void;
};

const defaultListUrl = 'https://maps.app.goo.gl/qgA3V8L7UAozSY2x9';

export function GoogleMapsSyncDialog({ onClose, onSynced }: GoogleMapsSyncDialogProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState(defaultListUrl);
  const [preview, setPreview] = useState<GoogleMapsListPreview | null>(null);
  const [selectedSyncKeys, setSelectedSyncKeys] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<GoogleMapsListSyncResult | null>(null);
  const [formError, setFormError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const selectedCount = selectedSyncKeys.size;

  async function loadList() {
    setFormError('');
    setResult(null);
    setIsPreviewLoading(true);

    try {
      const nextPreview = await previewGoogleMapsList(googleMapsUrl);
      setPreview(nextPreview);
      setSelectedSyncKeys(new Set(nextPreview.places.map((place) => place.syncKey)));
    } catch (previewError) {
      setFormError(previewError instanceof Error ? previewError.message : 'Google Maps 즐겨찾기 목록을 읽지 못했습니다.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function syncList() {
    setFormError('');
    setResult(null);
    setIsSyncing(true);

    try {
      const nextResult = await syncGoogleMapsList(googleMapsUrl, Array.from(selectedSyncKeys));
      setResult(nextResult);
      onSynced();
    } catch (syncError) {
      setFormError(syncError instanceof Error ? syncError.message : 'Google Maps 즐겨찾기 목록을 가져오지 못했습니다.');
    } finally {
      setIsSyncing(false);
    }
  }

  function togglePlace(syncKey: string) {
    setSelectedSyncKeys((current) => {
      const next = new Set(current);
      if (next.has(syncKey)) next.delete(syncKey);
      else next.add(syncKey);
      return next;
    });
  }

  function selectAll() {
    setSelectedSyncKeys(new Set(preview?.places.map((place) => place.syncKey) ?? []));
  }

  function clearSelection() {
    setSelectedSyncKeys(new Set());
  }

  return (
    <ModalFrame title="Google Maps 즐겨찾기 가져오기" maxWidth="max-w-5xl" scroll onClose={onClose}>
      <div className="grid gap-5 p-5">
        <label className="grid gap-2 text-sm font-semibold">
          공유 목록 링크
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              value={googleMapsUrl}
              onChange={(event) => {
                setGoogleMapsUrl(event.target.value);
                setPreview(null);
                setResult(null);
                setSelectedSyncKeys(new Set());
              }}
              placeholder="https://maps.app.goo.gl/..."
            />
            <Button onClick={loadList} disabled={!googleMapsUrl.trim() || isPreviewLoading || isSyncing}>
              {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              목록 조회
            </Button>
          </div>
        </label>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
          조회된 장소는 기본으로 모두 선택됩니다. 앱에서 삭제한 장소는 <span className="font-semibold text-foreground">deleted</span>{' '}
          상태로 남겨 다음 동기화 때 다시 생기지 않습니다.
        </div>

        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        {preview ? (
          <div className="grid gap-3">
            <div className="flex flex-col gap-3 rounded-md border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-bold">{preview.listTitle ?? 'Google Maps 목록'}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  총 {preview.requestedCount}개 중 {preview.places.length}개 조회 · 선택 {selectedCount}개
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" size="sm" onClick={selectAll} disabled={!preview.places.length}>
                  모두 선택
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection} disabled={!selectedCount}>
                  모두 해제
                </Button>
              </div>
            </div>

            {preview.warnings.length ? (
              <div className="rounded-md border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="grid max-h-[52vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {preview.places.map((place) => (
                <PreviewPlaceCard
                  key={place.syncKey}
                  place={place}
                  checked={selectedSyncKeys.has(place.syncKey)}
                  onToggle={() => togglePlace(place.syncKey)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-3 rounded-md border bg-background p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold">{result.listTitle ?? 'Google Maps 목록'}</div>
              <div className="text-muted-foreground">총 {result.requestedCount}개</div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SyncStat label="추가" value={result.createdCount} />
              <SyncStat label="이미 있음" value={result.skippedExistingCount} />
              <SyncStat label="삭제됨" value={result.skippedDeletedCount} />
              <SyncStat label="실패" value={result.failedCount} />
            </div>
            {result.warnings.length ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={syncList} disabled={!googleMapsUrl.trim() || !selectedCount || isPreviewLoading || isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
            선택 {selectedCount}개 가져오기
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}

function PreviewPlaceCard({
  place,
  checked,
  onToggle
}: {
  place: GoogleMapsListPreviewPlace;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`grid cursor-pointer grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-md border bg-background p-3 transition ${
        checked ? 'border-primary/70 bg-primary/5 ring-1 ring-primary/20' : 'hover:border-primary/50 hover:bg-muted/25'
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
        </div>
        {place.thumbnailUrl ? (
          <img
            alt={`${place.name} 사진`}
            className="relative h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={place.thumbnailUrl}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <input
            checked={checked}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            type="checkbox"
            onChange={onToggle}
          />
          <div className="min-w-0">
            <div className="truncate font-bold">{place.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{categoryLabel(place.category)}</span>
              <span>·</span>
              <span>{place.distanceLabel}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">{place.menu}</div>
        <div className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-5 text-foreground/75">
          {place.description}
        </div>
        <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
          메모: {getGoogleMapsNoteLabel(place)}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{place.address}</span>
        </div>
      </div>
    </label>
  );
}

function categoryLabel(category: string) {
  if (category === 'dessert') return '디저트';
  if (category === 'sightseeing') return '관광';
  return '맛집';
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
