import { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import {
  defaultDayDepartureTimeMinutes,
  departureTimeStepMinutes,
  formatDepartureTime,
  normalizeDepartureTimeMinutes
} from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';

type DepartureTimePickerProps = {
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
  description?: string;
  compact?: boolean;
};

const maxDepartureTimeMinutes = 24 * 60 - departureTimeStepMinutes;
const timeMarks = [
  { label: '0시', value: 0 },
  { label: '6시', value: 6 * 60 },
  { label: '12시', value: 12 * 60 },
  { label: '18시', value: 18 * 60 },
  { label: '24시', value: maxDepartureTimeMinutes }
];

export function DepartureTimePicker({ label, value, onChange, description, compact }: DepartureTimePickerProps) {
  const normalizedValue = normalizeDepartureTimeMinutes(value);
  const committedValue = normalizedValue ?? defaultDayDepartureTimeMinutes;
  const [draftValue, setDraftValue] = useState(committedValue);
  const draftValueRef = useRef(committedValue);
  const hasPendingCommitRef = useRef(false);

  useEffect(() => {
    draftValueRef.current = committedValue;
    setDraftValue(committedValue);
    hasPendingCommitRef.current = false;
  }, [committedValue]);

  function updateDraft(nextValue: number) {
    draftValueRef.current = nextValue;
    hasPendingCommitRef.current = true;
    setDraftValue(nextValue);
  }

  function commitDraft() {
    if (!hasPendingCommitRef.current) return;

    hasPendingCommitRef.current = false;
    const nextValue = normalizeDepartureTimeMinutes(draftValueRef.current) ?? defaultDayDepartureTimeMinutes;
    if (nextValue !== committedValue) {
      onChange(nextValue);
    }
  }

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-white p-3 dark:bg-secondary/80', compact && 'p-2.5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            {label}
          </div>
          {description ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p> : null}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-1 text-[11px] font-bold leading-none',
            'bg-primary/10 text-primary'
          )}
        >
          {formatDepartureTime(draftValue)}
        </span>
      </div>

      <div className="mt-3">
        <div className="min-w-0">
          <input
            type="range"
            min={0}
            max={maxDepartureTimeMinutes}
            step={departureTimeStepMinutes}
            value={draftValue}
            className="h-2 w-full cursor-pointer select-none accent-primary [touch-action:pan-x]"
            data-pull-refresh-ignore
            aria-label={`${label} 시간 선택`}
            onBlur={commitDraft}
            onChange={(event) => updateDraft(Number(event.currentTarget.value))}
            onKeyUp={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
                commitDraft();
              }
            }}
            onPointerUp={commitDraft}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
            {timeMarks.map((mark) => (
              <span key={mark.value}>{mark.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
