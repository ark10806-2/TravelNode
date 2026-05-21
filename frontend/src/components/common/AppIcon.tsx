import { cn } from '@/lib/utils';

type AppIconProps = {
  className?: string;
  title?: string;
};

export function AppIcon({ className, title = 'Japan Trip Planner' }: AppIconProps) {
  return (
    <span className={cn('relative block shrink-0', className)} role="img" aria-label={title}>
      <img
        className="h-full w-full object-contain dark:hidden"
        src="/app-icon-light.png?v=5"
        alt=""
        draggable={false}
      />
      <img
        className="hidden h-full w-full object-contain dark:block"
        src="/app-icon-dark.png?v=5"
        alt=""
        draggable={false}
      />
    </span>
  );
}
