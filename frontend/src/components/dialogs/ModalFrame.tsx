import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ModalFrameProps = {
  title: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  scroll?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
};

let activeModalCount = 0;
let lockedScrollY = 0;
let previousBodyStyle: Pick<CSSStyleDeclaration, 'overflow' | 'position' | 'top' | 'width'> | null = null;

export function ModalFrame({
  title,
  eyebrow,
  children,
  onClose,
  maxWidth = 'max-w-xl',
  scroll,
  overlayClassName,
  panelClassName,
  headerClassName
}: ModalFrameProps) {
  useEffect(() => {
    if (activeModalCount === 0) {
      lockedScrollY = window.scrollY;
      previousBodyStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width
      };
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.width = '100%';
    }

    activeModalCount += 1;

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount > 0 || !previousBodyStyle) return;

      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      previousBodyStyle = null;
      window.scrollTo(0, lockedScrollY);
    };
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-foreground/35 p-2 sm:items-center sm:p-4',
        overlayClassName
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-md border bg-background shadow-xl',
          maxWidth,
          scroll && 'max-h-[94vh] overflow-y-auto overscroll-contain sm:max-h-[92vh]',
          panelClassName
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background px-4 py-3 sm:px-5 sm:py-4',
            headerClassName
          )}
        >
          <div className="min-w-0">
            {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
            <h2 className="truncate text-lg font-bold sm:text-xl">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
