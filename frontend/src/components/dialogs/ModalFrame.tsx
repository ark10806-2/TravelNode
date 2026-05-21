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
let previousBodyStyle: Pick<CSSStyleDeclaration, 'overflow' | 'position' | 'top' | 'width' | 'touchAction'> | null = null;
let previousDocumentStyle: Pick<CSSStyleDeclaration, 'overflow' | 'overscrollBehavior'> | null = null;
let usesPositionScrollLock = true;

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
      usesPositionScrollLock = !shouldPreserveMobileVisualViewport();
      previousBodyStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        touchAction: document.body.style.touchAction
      };
      previousDocumentStyle = {
        overflow: document.documentElement.style.overflow,
        overscrollBehavior: document.documentElement.style.overscrollBehavior
      };
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';

      if (usesPositionScrollLock) {
        document.body.style.position = 'fixed';
        document.body.style.top = `-${lockedScrollY}px`;
      } else {
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'none';
      }
    }

    activeModalCount += 1;

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount > 0 || !previousBodyStyle) return;

      const shouldRestoreScroll = usesPositionScrollLock;
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      document.body.style.touchAction = previousBodyStyle.touchAction;
      if (previousDocumentStyle) {
        document.documentElement.style.overflow = previousDocumentStyle.overflow;
        document.documentElement.style.overscrollBehavior = previousDocumentStyle.overscrollBehavior;
      }
      previousBodyStyle = null;
      previousDocumentStyle = null;
      if (shouldRestoreScroll) window.scrollTo(0, lockedScrollY);
    };
  }, []);

  return (
    <div
      className={cn(
        'modal-overlay-enter fixed inset-x-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] items-end justify-center overscroll-contain bg-foreground/35 p-2 sm:items-center sm:p-4',
        overlayClassName
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'modal-panel-enter w-full overflow-hidden rounded-md border bg-background shadow-xl',
          maxWidth,
          scroll && 'max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain sm:max-h-[92dvh]',
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

function shouldPreserveMobileVisualViewport() {
  return Boolean(
    window.visualViewport &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
      window.matchMedia('(max-width: 767px)').matches
  );
}
