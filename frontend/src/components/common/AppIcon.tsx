import { useId } from 'react';
import { cn } from '@/lib/utils';

type AppIconProps = {
  className?: string;
  title?: string;
};

export function AppIcon({ className, title = 'Japan Trip Planner' }: AppIconProps) {
  const rawId = useId().replace(/:/g, '');
  const ids = {
    bg: `app-icon-bg-${rawId}`,
    shine: `app-icon-shine-${rawId}`,
    grain: `app-icon-grain-${rawId}`,
    tileShadow: `app-icon-tile-shadow-${rawId}`,
    planeShadow: `app-icon-plane-shadow-${rawId}`,
    clip: `app-icon-clip-${rawId}`
  };

  return (
    <svg
      className={cn('block overflow-visible drop-shadow-[0_8px_14px_rgba(49,130,246,0.2)]', className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={ids.bg} x1="18" y1="10" x2="82" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5AA7FF" />
          <stop offset="0.48" stopColor="#3182F6" />
          <stop offset="1" stopColor="#1769E0" />
        </linearGradient>
        <radialGradient id={ids.shine} cx="31" cy="21" r="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.48" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.grain} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" seed="7" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.07" />
          </feComponentTransfer>
        </filter>
        <filter id={ids.tileShadow} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0057C2" floodOpacity="0.22" />
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#062B62" floodOpacity="0.12" />
        </filter>
        <filter id={ids.planeShadow} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#003B86" floodOpacity="0.26" />
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#FFFFFF" floodOpacity="0.28" />
        </filter>
        <clipPath id={ids.clip}>
          <rect x="8" y="8" width="80" height="80" rx="24" />
        </clipPath>
      </defs>

      <rect x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.bg})`} filter={`url(#${ids.tileShadow})`} />
      <g clipPath={`url(#${ids.clip})`}>
        <rect x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.shine})`} />
        <rect x="8" y="8" width="80" height="80" rx="24" filter={`url(#${ids.grain})`} opacity="0.48" />
        <path d="M19 66C39 62 58 49 82 25" fill="none" stroke="#FFFFFF" strokeOpacity="0.11" strokeWidth="10" strokeLinecap="round" />
        <path d="M17 28C31 23 48 21 71 24" fill="none" stroke="#FFFFFF" strokeOpacity="0.09" strokeWidth="7" strokeLinecap="round" />
      </g>

      <rect x="8.75" y="8.75" width="78.5" height="78.5" rx="23.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.34" strokeWidth="1.5" />
      <g filter={`url(#${ids.planeShadow})`}>
        <path
          fill="#FFFFFF"
          d="M68.5 27.2c1.3 1.3 1.7 3.1.8 4.8L58.4 53.1l7.1 7.1c.8.8 1 2 .5 3l-1.3 3.2c-.3.8-1.3 1-1.9.4L52.4 56.4 42 66.8c-.6.6-1.4.9-2.2.9h-5.7c-.9 0-1.3-1.1-.7-1.7l13.4-13.4-9.5-9.5-8.2 3.8c-.8.4-1.7.2-2.3-.4l-2.3-2.3c-.7-.7-.4-1.9.5-2.3l17.7-7.5 13.8-13.8c3.5-3.5 9.3-3.5 12 0z"
        />
        <path
          fill="#DCEEFF"
          opacity="0.9"
          d="M57.7 25.1 44.5 38.3l-13.6 5.8 7.4 7.4 11.5-11.5c.6-.6 1.6-.6 2.2 0s.6 1.6 0 2.2L40.5 53.7l2.4 2.4 10.3-10.3c.6-.6 1.6-.6 2.2 0s.6 1.6 0 2.2L45.1 58.3l-5.9 5.9h.6l11.5-11.5c.6-.6 1.6-.6 2.2 0l9.1 9.1.3-.7-7.4-7.4c-.5-.5-.6-1.2-.3-1.9l11.4-22c.2-.4.1-.8-.2-1.1-1.5-1.5-5.3-1.4-8.7 2.4z"
        />
      </g>
    </svg>
  );
}
