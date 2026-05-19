import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Car, ExternalLink, Footprints, RefreshCw, Save, Train } from 'lucide-react';
import { fetchApiUsage, updateApiUsage, type ApiUsageItem, type ApiUsageSummary } from '@/api/usage';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loadEnabledRouteModes, normalizeEnabledRouteModes, storeEnabledRouteModes } from '@/lib/route-preferences';
import { cn } from '@/lib/utils';
import type { RouteMode } from '@/types/schedule';

type UsagePageProps = {
  isEditing: boolean;
};

type DraftValue = {
  used: string;
  limit: string;
};

const statusLabel: Record<ApiUsageItem['status'], string> = {
  normal: '정상',
  warning: '주의',
  danger: '위험',
  exceeded: '초과'
};

const statusClass: Record<ApiUsageItem['status'], string> = {
  normal: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200',
  danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200',
  exceeded: 'border-red-300 bg-red-100 text-red-900 dark:border-red-800/80 dark:bg-red-950/45 dark:text-red-100'
};

export function UsagePage({ isEditing }: UsagePageProps) {
  const [summary, setSummary] = useState<ApiUsageSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [enabledRouteModes, setEnabledRouteModes] = useState<RouteMode[]>(loadEnabledRouteModes);

  const totalStatus = useMemo(() => {
    if (!summary) return 'normal';
    if (summary.totalPercentage >= 100) return 'exceeded';
    if (summary.totalPercentage >= 85) return 'danger';
    if (summary.totalPercentage >= 70) return 'warning';
    return 'normal';
  }, [summary]);

  async function loadUsage() {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    setError('');

    try {
      const nextSummary = await fetchApiUsage();
      setSummary(nextSummary);
      setDrafts(toDrafts(nextSummary));
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : 'API 사용량을 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    void loadUsage();
    const timer = window.setInterval(() => {
      if (!isEditing) void loadUsage();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isEditing]);

  async function saveService(service: ApiUsageItem) {
    const draft = drafts[service.serviceId];
    const used = Number(draft?.used);
    const limit = Number(draft?.limit);

    if (!Number.isInteger(used) || used < 0 || !Number.isInteger(limit) || limit <= 0) {
      setError('현재값은 0 이상, 제한값은 1 이상의 정수로 입력해주세요.');
      setStatus('error');
      return;
    }

    setSavingServiceId(service.serviceId);
    setError('');
    try {
      const nextSummary = await updateApiUsage(service.serviceId, used, limit);
      setSummary(nextSummary);
      setDrafts(toDrafts(nextSummary));
      setStatus('ready');
    } catch (saveError) {
      setStatus('error');
      setError(saveError instanceof Error ? saveError.message : 'API 사용량을 저장하지 못했습니다.');
    } finally {
      setSavingServiceId(null);
    }
  }

  function toggleRouteMode(mode: RouteMode) {
    if (!isEditing) return;

    const nextModes = enabledRouteModes.includes(mode)
      ? enabledRouteModes.filter((candidate) => candidate !== mode)
      : normalizeEnabledRouteModes([...enabledRouteModes, mode]);
    const normalized = normalizeEnabledRouteModes(nextModes);
    setEnabledRouteModes(normalized);
    storeEnabledRouteModes(normalized);
  }

  return (
    <PageContainer className="grid gap-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline">Google API</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">API 사용량</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            이번 달 이 앱에서 발생한 Google API 호출을 Google Maps Platform 월간 무료 사용량 기준과 비교합니다.
          </p>
          {isEditing ? (
            <p className="mt-2 text-xs text-muted-foreground">
              이번 달 사용량과 월간 한도를 직접 보정할 수 있습니다. 실패한 Google 요청은 자동 집계에 포함하지 않습니다.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadUsage()} disabled={status === 'loading'}>
            <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="outline" asChild>
            <a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Google Console
            </a>
          </Button>
        </div>
      </div>

      {status === 'error' ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-md border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">이번 달 전체</div>
              <div className="mt-1 text-3xl font-bold">{summary ? `${summary.totalUsed}/${summary.totalLimit}` : '-'}</div>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-md bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <ProgressBar value={summary?.totalPercentage ?? 0} status={totalStatus} className="mt-4" />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">사용률</span>
            <span className="font-semibold">{formatPercent(summary?.totalPercentage ?? 0)}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            기간 {summary ? `${summary.periodStart} ~ ${summary.periodEnd}` : '-'} · 한도는 `GOOGLE_API_MONTHLY_LIMITS` 값입니다.
          </div>
        </div>

        <div className="rounded-md border bg-background p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">서비스별 사용량</h2>
            {summary && summary.totalPercentage >= 70 ? (
              <Badge className={statusClass[totalStatus]}>
                <AlertTriangle className="mr-1 h-3 w-3" />
                {statusLabel[totalStatus]}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-3">
            {(summary?.services ?? []).map((service) => (
              <UsageRow
                key={service.serviceId}
                service={service}
                draft={drafts[service.serviceId] ?? { used: String(service.used), limit: String(service.limit) }}
                isEditing={isEditing}
                isSaving={savingServiceId === service.serviceId}
                onDraftChange={(field, value) =>
                  setDrafts((current) => ({
                    ...current,
                    [service.serviceId]: {
                      ...(current[service.serviceId] ?? { used: String(service.used), limit: String(service.limit) }),
                      [field]: value
                    }
                  }))
                }
                onSave={() => void saveService(service)}
              />
            ))}
            {!summary ? (
              <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">불러오는 중입니다.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">이동 수단 표시 및 계산</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              선택한 이동 수단만 일정 화면에 보이고 경로 계산 대상이 됩니다. 꺼진 이동 수단은 백그라운드에서도 Routes API를 호출하지 않습니다.
            </p>
          </div>
          {!isEditing ? <Badge variant="outline">편집 모드에서 변경</Badge> : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {routeModeOptions.map((option) => {
            const Icon = option.icon;
            const isEnabled = enabledRouteModes.includes(option.id);

            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-muted/10 p-3 text-left transition',
                  isEditing && 'hover:bg-muted/30',
                  isEnabled && 'border-primary/35 bg-primary/10 text-primary',
                  !isEditing && 'cursor-default opacity-80'
                )}
                disabled={!isEditing}
                onClick={() => toggleRouteMode(option.id)}
              >
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-muted-foreground', isEnabled && 'text-primary')}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}

const routeModeOptions: Array<{
  id: RouteMode;
  label: string;
  description: string;
  icon: typeof Car;
}> = [
  {
    id: 'transit',
    label: '대중교통',
    description: '최적화 기본 기준입니다. 출발 기준 시간에 따라 캐시가 분리됩니다.',
    icon: Train
  },
  {
    id: 'walking',
    label: '도보',
    description: '거리 기반으로 안정적이라 오래 캐시합니다. 최적화에서 우선 사용합니다.',
    icon: Footprints
  },
  {
    id: 'driving',
    label: '자동차',
    description: '표시할 때만 계산합니다. 정밀계산 시 실시간 교통을 반영합니다.',
    icon: Car
  }
];

function UsageRow({
  service,
  draft,
  isEditing,
  isSaving,
  onDraftChange,
  onSave
}: {
  service: ApiUsageItem;
  draft: DraftValue;
  isEditing: boolean;
  isSaving: boolean;
  onDraftChange: (field: keyof DraftValue, value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/15 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)_5rem] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate font-semibold">{service.name}</div>
          <Badge className={statusClass[service.status]}>{statusLabel[service.status]}</Badge>
        </div>
        <ProgressBar value={service.percentage} status={service.status} className="mt-2" />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <NumberField
          label="이번 달 사용량"
          value={draft.used}
          readOnly={!isEditing}
          onChange={(value) => onDraftChange('used', value)}
        />
        <div className="pb-2 text-sm text-muted-foreground">/</div>
        <NumberField
          label="월간 한도"
          value={draft.limit}
          readOnly={!isEditing}
          onChange={(value) => onDraftChange('limit', value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <div className="text-sm font-semibold">{formatPercent(service.percentage)}</div>
        {isEditing ? (
          <Button size="sm" variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  readOnly,
  onChange
}: {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        className="h-9 min-w-0 rounded-md border bg-background px-2 text-right text-sm font-semibold read-only:border-transparent read-only:bg-transparent read-only:px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        inputMode="numeric"
        min={label.includes('한도') ? 1 : 0}
        readOnly={readOnly}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ProgressBar({
  value,
  status,
  className
}: {
  value: number;
  status: ApiUsageItem['status'];
  className?: string;
}) {
  const color = status === 'exceeded' || status === 'danger' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className={`h-2 overflow-hidden rounded-full bg-muted ${className ?? ''}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function toDrafts(summary: ApiUsageSummary): Record<string, DraftValue> {
  return Object.fromEntries(
    summary.services.map((service) => [
      service.serviceId,
      {
        used: String(service.used),
        limit: String(service.limit)
      }
    ])
  );
}
