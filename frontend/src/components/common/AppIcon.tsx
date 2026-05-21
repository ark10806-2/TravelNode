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
    depth: `app-icon-depth-${rawId}`,
    gloss: `app-icon-gloss-${rawId}`,
    grain: `app-icon-grain-${rawId}`,
    tileShadow: `app-icon-tile-shadow-${rawId}`,
    innerShadow: `app-icon-inner-shadow-${rawId}`,
    planeShadow: `app-icon-plane-shadow-${rawId}`,
    clip: `app-icon-clip-${rawId}`
  };

  return (
    <svg
      className={cn('block overflow-visible drop-shadow-[0_10px_18px_rgba(49,130,246,0.24)]', className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={ids.bg} x1="18" y1="8" x2="80" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#83C2FF" />
          <stop offset="0.25" stopColor="#4C9DFF" />
          <stop offset="0.62" stopColor="#3182F6" />
          <stop offset="1" stopColor="#125ECF" />
        </linearGradient>
        <linearGradient id={ids.depth} x1="48" y1="10" x2="48" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.36" />
          <stop offset="0.38" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="0.72" stopColor="#0A4AA8" stopOpacity="0.2" />
          <stop offset="1" stopColor="#083B8A" stopOpacity="0.36" />
        </linearGradient>
        <radialGradient id={ids.gloss} cx="30" cy="18" r="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
          <stop offset="0.34" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.tileShadow} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="13" stdDeviation="8" floodColor="#0047A6" floodOpacity="0.32" />
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#062B62" floodOpacity="0.18" />
        </filter>
        <filter id={ids.innerShadow} x="-10%" y="-10%" width="120%" height="120%">
          <feOffset dx="0" dy="2" />
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="blur" in2="SourceAlpha" operator="out" result="shadow" />
          <feColorMatrix in="shadow" type="matrix" values="0 0 0 0 0.02 0 0 0 0 0.18 0 0 0 0 0.43 0 0 0 .42 0" />
          <feComposite in2="SourceGraphic" operator="atop" />
        </filter>
        <filter id={ids.grain} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="19" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .22 0" />
        </filter>
        <filter id={ids.planeShadow} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="4" floodColor="#073D89" floodOpacity="0.42" />
          <feDropShadow dx="-1" dy="-1" stdDeviation="0.6" floodColor="#FFFFFF" floodOpacity="0.52" />
        </filter>
        <clipPath id={ids.clip}>
          <rect x="8" y="8" width="80" height="80" rx="24" />
        </clipPath>
      </defs>

      <rect x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.bg})`} filter={`url(#${ids.tileShadow})`} />
      <g clipPath={`url(#${ids.clip})`}>
        <rect x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.depth})`} />
        <rect x="8" y="8" width="80" height="80" rx="24" fill={`url(#${ids.gloss})`} />
        <rect x="8" y="8" width="80" height="80" rx="24" filter={`url(#${ids.grain})`} opacity="0.55" />
        <path d="M18 65C35 64 56 52 83 24" fill="none" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="11" strokeLinecap="round" />
        <path d="M17 32C31 24 51 21 77 24" fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="8" strokeLinecap="round" />
        <path d="M20 78C34 75 48 68 65 55" fill="none" stroke="#0C58BF" strokeOpacity="0.2" strokeWidth="12" strokeLinecap="round" />
      </g>
      <rect x="9" y="9" width="78" height="78" rx="23" fill="none" stroke="#FFFFFF" strokeOpacity="0.48" strokeWidth="1.6" />
      <rect x="10.5" y="10.5" width="75" height="75" rx="21.5" fill="none" stroke="#0649A8" strokeOpacity="0.18" strokeWidth="1" filter={`url(#${ids.innerShadow})`} />

      <g filter={`url(#${ids.planeShadow})`}>
        <path
          d="M69.2 25.6c1.7 1.6 2.1 3.9 1 5.9L58.6 52.9l7.4 7.5c.8.8 1.1 2 .6 3.1l-1.7 4.1c-.4 1-1.7 1.3-2.5.5L52.1 57.7 41.4 68.4c-.7.7-1.6 1-2.5 1h-6.6c-1 0-1.5-1.3-.8-2l13.2-13.2-9.1-9.1-8.5 3.7c-.9.4-1.9.2-2.6-.5l-2.8-2.8c-.8-.8-.5-2.2.6-2.7l18.3-7.5 13.7-13.7c4.2-4.2 11.5-4.6 14.9-1z"
          fill="#FFFFFF"
        />
        <path
          d="M58.1 25.1 45.6 37.6 32.3 43l6.1 6.1 11.8-11.8c.7-.7 1.8-.7 2.5 0s.7 1.8 0 2.5L40.9 51.6l3.1 3.1 10.7-10.7c.7-.7 1.8-.7 2.5 0s.7 1.8 0 2.5L46.5 57.2l-6.7 6.7h.9l11.2-11.2c.7-.7 1.8-.7 2.5 0l8.6 8.6.4-1-7.3-7.3c-.6-.6-.7-1.4-.3-2.1l11.3-21.3c.3-.5.2-1-.2-1.4-1.8-1.9-5.8-1.2-8.8 1.9z"
          fill="#D9ECFF"
          opacity="0.98"
        />
        <path d="M33.5 43.2 45.5 38.3 40 43.8 37.4 48.2z" fill="#8EC6FF" opacity="0.75" />
        <path d="M44 54.6 51.9 46.7 53.8 53.9 48.2 59.5z" fill="#9ED0FF" opacity="0.78" />
      </g>
    </svg>
  );
}
