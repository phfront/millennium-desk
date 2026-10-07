// Icones pequenos do modulo Cenas e do Controle (traco, cor do texto)

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const MicIcon = ({ muted = false, size = 15 }: { muted?: boolean; size?: number }) =>
  muted ? (
    <svg width={size} height={size} {...base}>
      <path d="M3 3l18 18M9 9v2a3 3 0 005.1 2.1M15 9.3V5a3 3 0 00-5.7-1.3M19 11a7 7 0 01-1.3 4M5 11a7 7 0 0010.4 6.1M12 18v4" />
    </svg>
  ) : (
    <svg width={size} height={size} {...base}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v4" />
    </svg>
  );

export const HeadphonesIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M3 18v-6a9 9 0 0118 0v6" />
    <path d="M21 19a2 2 0 01-2 2h-1v-6h3zM3 19a2 2 0 002 2h1v-6H3z" />
  </svg>
);

export const MoonIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

export const WarningIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5" />
  </svg>
);

export const SpeakerIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />
  </svg>
);

export const GridIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const SlidersIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
);

export const MuteSpeakerIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M16 9l5 5M21 9l-5 5" />
  </svg>
);

export const GearIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);
