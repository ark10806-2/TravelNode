import { useId } from 'react';
import { cn } from '@/lib/utils';

type AppIconProps = {
  className?: string;
  title?: string;
};

export function AppIcon({ className, title = 'Japan Trip Planner' }: AppIconProps) {
  const rawId = useId().replace(/:/g, '');
  const ids = {
    tileShadow: `app-icon-tile-shadow-${rawId}`,
    planeShadow: `app-icon-plane-shadow-${rawId}`,
    wing: `app-icon-wing-${rawId}`,
    blade: `app-icon-blade-${rawId}`,
    crease: `app-icon-crease-${rawId}`,
    lightSurface: `app-icon-light-surface-${rawId}`,
    darkSurface: `app-icon-dark-surface-${rawId}`,
    clip: `app-icon-clip-${rawId}`
  };

  return (
    <svg
      className={cn('block overflow-visible drop-shadow-[0_8px_18px_rgba(0,100,255,0.18)] dark:drop-shadow-[0_10px_22px_rgba(0,0,0,0.34)]', className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={ids.lightSurface} x1="18" y1="10" x2="76" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.62" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F4F7FB" />
        </linearGradient>
        <linearGradient id={ids.darkSurface} x1="18" y1="10" x2="76" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#202735" />
          <stop offset="0.52" stopColor="#121826" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
        <linearGradient id={ids.wing} x1="22" y1="30" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#19C8FF" />
          <stop offset="0.5" stopColor="#0088FF" />
          <stop offset="1" stopColor="#0057FF" />
        </linearGradient>
        <linearGradient id={ids.blade} x1="54" y1="18" x2="78" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#25D0FF" />
          <stop offset="0.45" stopColor="#006DFF" />
          <stop offset="1" stopColor="#003FE8" />
        </linearGradient>
        <linearGradient id={ids.crease} x1="50" y1="73" x2="66" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="0.42" stopColor="#9DE7FF" stopOpacity="0.58" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.14" />
        </linearGradient>
        <filter id={ids.tileShadow} x="-25%" y="-25%" width="150%" height="165%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.12" />
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
        <filter id={ids.planeShadow} x="-28%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#0057FF" floodOpacity="0.26" />
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#FFFFFF" floodOpacity="0.28" />
        </filter>
        <clipPath id={ids.clip}>
          <rect x="8" y="8" width="80" height="80" rx="24" />
        </clipPath>
      </defs>

      <rect className="fill-white dark:fill-[#111827]" x="8" y="8" width="80" height="80" rx="24" filter={`url(#${ids.tileShadow})`} />
      <g clipPath={`url(#${ids.clip})`}>
        <rect className="opacity-100 dark:opacity-0" x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.lightSurface})`} />
        <rect className="opacity-0 dark:opacity-100" x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.darkSurface})`} />
        <circle className="opacity-100 dark:opacity-70" cx="27" cy="20" r="26" fill="#FFFFFF" opacity="0.62" />
        <circle className="opacity-0 dark:opacity-100" cx="67" cy="76" r="28" fill="#0057FF" opacity="0.08" />
      </g>

      <rect className="stroke-slate-200/70 dark:stroke-white/10" x="8.75" y="8.75" width="78.5" height="78.5" rx="23.25" fill="none" strokeWidth="1.5" />

      <g filter={`url(#${ids.planeShadow})`}>
        <path
          d="M19.8 55.6C17.7 48.6 25.8 37.4 39.2 30.2C50 24.4 63.2 21.7 77.3 23.4C66.3 35.2 55.3 47.5 45.2 58.8C34.4 62.1 23.2 60.9 19.8 55.6Z"
          fill={`url(#${ids.wing})`}
        />
        <path
          d="M77.3 23.4C77.1 38.9 70.9 60.3 55.8 77.2C51.4 74.8 48.9 70.6 49.8 65.8C54.2 50.2 63.7 34.5 77.3 23.4Z"
          fill={`url(#${ids.blade})`}
        />
        <path
          d="M75.2 25.4C64.8 38.9 55.2 55.1 51.4 74.6"
          fill="none"
          stroke={`url(#${ids.crease})`}
          strokeLinecap="round"
          strokeWidth="2.8"
        />
        <path
          d="M24.7 53.2C38.5 47.7 52.7 37.7 72.6 24.6"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeOpacity="0.18"
          strokeWidth="2.2"
        />
      </g>
    </svg>
  );
}
