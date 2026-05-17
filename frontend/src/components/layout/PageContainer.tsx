import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

type PageContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function PageContainer({ className, children }: PageContainerProps) {
  return (
    <div className={cn('mx-auto flex w-full max-w-none flex-col gap-5 px-3 py-4 sm:px-4 lg:px-5', className)}>
      {children}
    </div>
  );
}
