import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ModalFrameProps = {
  title: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  scroll?: boolean;
};

export function ModalFrame({ title, eyebrow, children, onClose, maxWidth = 'max-w-xl', scroll }: ModalFrameProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-2 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full overflow-hidden rounded-md border bg-background shadow-xl ${maxWidth} ${
          scroll ? 'max-h-[94vh] overflow-y-auto sm:max-h-[92vh]' : ''
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background px-4 py-3 sm:px-5 sm:py-4">
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
