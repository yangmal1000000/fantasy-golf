/**
 * icons.tsx — Shared SVG icon components.
 * Clean, consistent stroke-based icons (stroke-width 1.5, 24x24 viewBox, currentColor).
 * Replaces all emoji usage with professional inline SVGs.
 *
 * Usage:
 *   import { TrophyIcon, StarIcon } from "@/components/icons";
 *   <TrophyIcon className="h-5 w-5 text-amber-400" />
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  viewBox: "0 0 24 24",
  strokeWidth: 1.5,
  stroke: "currentColor",
  ...props,
});

/** ⛳ Golf flag */
export function GolfFlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V4a1 1 0 011-1h6.5l1.5 2H21l-3.5 4.5L21 16h-9l-1.5-2H5v7" />
    </svg>
  );
}

/** 🏆 Trophy */
export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M6 4h12v4a6 6 0 01-12 0V4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6H4a2 2 0 002 4m14-4h-2a2 2 0 00-2 4" />
    </svg>
  );
}

/** £ Pound sterling sign */
export function PoundIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11h7M7 7h10M7 11c0 3-1 5-3 7M10 11l-2 8M13 16c1 1 2 2 4 2" />
    </svg>
  );
}

/** 🚩 Flag (plain) */
export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V4a1 1 0 011-1h6.5l1 1H21l-3 4 3 4h-8.5l-1-1H5" />
    </svg>
  );
}

/** 📍 Map pin */
export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.5-7-12a7 7 0 1114 0c0 5.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

/** 💰 Money / pound */
export function MoneyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18M7 7v10M7 12c2 0 3-1 3-2.5S9 7 7 7m4 5l3 5m0-5c0 2 1 3 3 3s3-1 3-3-1-3-3-3-3 1-3 3z" />
    </svg>
  );
}

/** 📊 Bar chart */
export function ChartBarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14v4M12 8v10M17 4v14" />
    </svg>
  );
}

/** ⭐ Star */
export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
    </svg>
  );
}

/** 👑 Crown */
export function CrownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18M4 8l4 4 4-6 4 6 4-4-2 10H6L4 8z" />
    </svg>
  );
}

/** 🛡️ Shield */
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L4 6v6c0 5 3 9 8 10 5-1 8-5 8-10V6l-8-4z" />
    </svg>
  );
}

/** 💎 Diamond */
export function DiamondIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l3 6-9 12L3 9l3-6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18" />
    </svg>
  );
}

/** ⚡ Lightning bolt */
export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
    </svg>
  );
}

/** 🎯 Target */
export function TargetIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** 🌍 Globe */
export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}

/** 📨 Mail / inbox */
export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v10a1 1 0 001 1h16a1 1 0 001-1V8M3 8l9-4 9 4" />
    </svg>
  );
}

/** ✅ Check circle */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l3 3 5-6" />
    </svg>
  );
}

/** 🎟️ Ticket */
export function TicketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V7a1 1 0 011-1h16a1 1 0 011 1v2a2 2 0 000 4v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a2 2 0 000-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 6v12" strokeDasharray="2 2" />
    </svg>
  );
}

/** 💸 Money wings / spending */
export function CashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

/** 📈 Trending up */
export function TrendingUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
    </svg>
  );
}

/** 📉 Trending down */
export function TrendingDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8M14 17h7v-7" />
    </svg>
  );
}

/** 🤝 Handshake / users */
export function HandshakeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l4-4 3 3 3-3 4 4-3 3-2-2-2 2-3-3-4 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6v8a2 2 0 01-2 2h-2" />
    </svg>
  );
}

/** 🏌️ Person golfing */
export function GolferIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="4" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v8m0 0l-3 8m3-8l3 8M9 10l3-2 3 2" />
    </svg>
  );
}

/** 🔒 Lock */
export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

/** ❤️ Heart */
export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-8-5.5-8-12a5 5 0 0110-2 5 5 0 0110 2c0 6.5-8 12-8 12z" />
    </svg>
  );
}

/** 📰 Newspaper */
export function NewspaperIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18v16H3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}

/** 🔔 Bell */
export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

/** 🌙 Moon */
export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

/** ☀️ Sun */
export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5M6 12H4.5m15.364 6.364l-1.06-1.06M6.343 6.343L5.282 5.282m13.435 0l-1.061 1.06M6.343 17.657l-1.061 1.061M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
    </svg>
  );
}

/** 📝 Note / document */
export function NoteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h10l4 4v14H5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v4h4M8 12h8M8 16h5" />
    </svg>
  );
}

/** 💬 Chat bubble */
export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12 7l-5 2 1.5-4A8 8 0 1121 12z" />
    </svg>
  );
}

/** ⏰ Clock / timer */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

/** ℹ️ Info */
export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5M12 8h.01" />
    </svg>
  );
}

/** ➕ Plus */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** 🔑 Key */
export function KeyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 11l9 9m-3-3l-2-2m-2-2l-3-3" />
    </svg>
  );
}

/** ⚠️ Warning triangle */
export function WarningIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 16H3l9-16z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v5M12 17h.01" />
    </svg>
  );
}

/** 👥 Users / group */
export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

/** 🏅 Medal */
export function MedalIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="15" r="6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9L6 3h12l-2 6M12 12v6M10 15h4" />
    </svg>
  );
}

/** 🐎 Horse (dark horse) */
export function HorseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21v-5l2-3-1-5 3-3 4 2h4l2 3v8a2 2 0 01-2 2H7a2 2 0 01-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-3M14 21v-3M16 9V6l-2-3" />
    </svg>
  );
}

/** 🦋 Butterfly (social) */
export function ButterflyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c0-3-3-7-6-7s-3 4-3 5 3 5 9 2zm0 0c0-3 3-7 6-7s3 4 3 5-3 5-9 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
    </svg>
  );
}

/** 🔥 Fire (streak) */
export function FireIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c0 3-4 4-4 8a4 4 0 008 0c0-2-1-3-1-5 0 0-3 1-3 3 0-3-1-4-1-6z" />
    </svg>
  );
}

/** 🐦 Bird (early bird) */
export function BirdIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8c4-2 8-1 12 2l4-2-2 4 2 4-4-2c-4 3-8 4-12 2-2-1-2-4 0-6 0 0 0-1 0-2z" />
      <circle cx="16" cy="9" r="0.5" fill="currentColor" />
    </svg>
  );
}

/** 📋 Clipboard */
export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6M9 15h4" />
    </svg>
  );
}

/** 📅 Calendar */
export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** 📐 Ruler / compass (estimated scores) */
export function RulerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l5-5 13 13-5 5L3 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l1 1M9 8l1 1M11 10l1 1M13 12l1 1M15 14l1 1" />
    </svg>
  );
}

/** 🥇 1st place medal */
export function Medal1Icon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="14" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7L7 2h10l-2 5" />
      <text x="12" y="17" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text>
    </svg>
  );
}

/** 🥈 2nd place medal */
export function Medal2Icon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="14" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7L7 2h10l-2 5" />
      <text x="12" y="17" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">2</text>
    </svg>
  );
}

/** 🥉 3rd place medal */
export function Medal3Icon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="14" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7L7 2h10l-2 5" />
      <text x="12" y="17" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">3</text>
    </svg>
  );
}

/** 📥 Download / inbox */
export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

/** 📤 Upload / share */
export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

/** 💡 Light bulb (tip) */
export function BulbIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z" />
    </svg>
  );
}

/** 🎰 Casino / side games */
export function CasinoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** 🔮 Crystal ball (projection) */
export function CrystalBallIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6M10 18v3M14 18v3" />
    </svg>
  );
}

/** ✂️ Scissors (cut) */
export function ScissorsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}

/** 🏁 Finish flag */
export function FinishFlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V3M4 4h12l-2 3 2 3H4" strokeDasharray="0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h8l-1.5 2L12 14H4" />
    </svg>
  );
}

/** ✨ Sparkles */
export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5L19 14z" />
    </svg>
  );
}

/** 📧 Envelope */
export function EnvelopeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
    </svg>
  );
}

/** ⚙️ Settings / gear */
export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93" />
    </svg>
  );
}

/** 🎰 Jackpot / slot */
export function JackpotIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 6V4M17 6V4M3 10h18" />
      <text x="8" y="16" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">7</text>
      <text x="12" y="16" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">7</text>
      <text x="16" y="16" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">7</text>
    </svg>
  );
}

/** 🌟 Star burst (best performer) */
export function StarBurstIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2 6 6-2-2 6 6 2-6 2 2 6-6-2-2 6-2-6-6 2 2-6-6-2 6-2z" />
    </svg>
  );
}

/** 😬 Sweat smile (tough round) */
export function ToughRoundIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14c1 2 3 3 4 3s3-1 4-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h.01M15 9h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9c0-1-1-2-2-2" />
    </svg>
  );
}

/** 💚 Green heart (loyal) */
export function GreenHeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-8-5.5-8-12a5 5 0 0110-2 5 5 0 0110 2c0 6.5-8 12-8 12z" />
    </svg>
  );
}

/** 👶 Baby (first steps) */
export function BabyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c0-4 3-7 7-7s7 3 7 7M9 10c1 1 4 1 6 0" />
    </svg>
  );
}

/** 🚀 Rocket (instant) */
export function RocketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c3 2 5 6 5 10l-2 4h-6l-2-4c0-4 2-8 5-10z" />
      <circle cx="12" cy="10" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-2 4M15 17l2 4" />
    </svg>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h11l-3-3M7 7l3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17H6l3 3M17 17l-3-3" />
    </svg>
  );
}

/**
 * ICON_MAP — String name → icon component lookup.
 * Used by config-driven rendering (TIER_CONFIG, CATEGORY_CONFIG, etc.)
 */
import type { ComponentType } from "react";

export const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  crown: CrownIcon,
  star: StarIcon,
  shield: ShieldIcon,
  diamond: DiamondIcon,
  bolt: BoltIcon,
  trophy: TrophyIcon,
  pound: PoundIcon,
  flag: FlagIcon,
  target: TargetIcon,
  globe: GlobeIcon,
  golf_flag: GolfFlagIcon,
  map_pin: MapPinIcon,
  money: MoneyIcon,
  chart_bar: ChartBarIcon,
  mail: MailIcon,
  check_circle: CheckCircleIcon,
  ticket: TicketIcon,
  cash: CashIcon,
  trending_up: TrendingUpIcon,
  trending_down: TrendingDownIcon,
  handshake: HandshakeIcon,
  golfer: GolferIcon,
  lock: LockIcon,
  heart: HeartIcon,
  newspaper: NewspaperIcon,
  bell: BellIcon,
  moon: MoonIcon,
  sun: SunIcon,
  note: NoteIcon,
  chat: ChatIcon,
  clock: ClockIcon,
  info: InfoIcon,
  plus: PlusIcon,
  key: KeyIcon,
  warning: WarningIcon,
  users: UsersIcon,
  medal: MedalIcon,
  horse: HorseIcon,
  butterfly: ButterflyIcon,
  fire: FireIcon,
  bird: BirdIcon,
  clipboard: ClipboardIcon,
  calendar: CalendarIcon,
  ruler: RulerIcon,
  medal1: Medal1Icon,
  medal2: Medal2Icon,
  medal3: Medal3Icon,
  download: DownloadIcon,
  upload: UploadIcon,
  bulb: BulbIcon,
  casino: CasinoIcon,
  crystal_ball: CrystalBallIcon,
  scissors: ScissorsIcon,
  finish_flag: FinishFlagIcon,
  sparkles: SparklesIcon,
  envelope: EnvelopeIcon,
  gear: GearIcon,
  jackpot: JackpotIcon,
  star_burst: StarBurstIcon,
  tough_round: ToughRoundIcon,
  green_heart: GreenHeartIcon,
  baby: BabyIcon,
  rocket: RocketIcon,
  swap: SwapIcon,
};

/** Helper: render an icon by name from the ICON_MAP */
export function IconByName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICON_MAP[name];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}
