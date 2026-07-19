import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SignInButton from "@/components/SignInButton";
import PushRegistration from "@/components/PushRegistration";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fantasy Golf — The Open 2026",
  description: "Pick your dream team for The Open Championship 2026. £15 entry, winner takes all.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fantasy Golf",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "Fantasy Golf — The Open 2026",
    description: "Pick your dream team for The Open Championship 2026. £15 entry, winner takes all.",
    url: "https://fantasy-golf-phi.vercel.app",
    siteName: "Fantasy Golf",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy Golf — The Open 2026",
    description: "Pick your dream team for The Open Championship 2026. £15 entry, winner takes all.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a3d2a",
};

// Inline script to prevent theme flash — runs before React hydration
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-[#0a3d2a] text-white shadow-lg safe-area-top">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c8a951] text-xs">
            ⛳
          </span>
          <span className="hidden xs:inline sm:inline">Fantasy Golf</span>
        </Link>

        {/* Desktop Nav links */}
        <nav className="hidden items-center gap-0.5 sm:flex">
          <NavLink href="/tournaments" label="Tournaments" />
          <NavLink href="/players" label="Players" />
          <NavLink href="/my-teams" label="My Teams" />
          <NavLink href="/leagues" label="Leagues" />
          <NavLink href="/tournaments/the-open-2026/leaderboard" label="Leaderboard" hideOnMd />
          <NavLink href="/how-to-play" label="How to Play" hideOnMd />
        </nav>

        {/* Right side: actions always visible */}
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <ThemeToggle />
          <SignInButton />
        </div>
      </div>
    </header>
  );
}

/** Desktop nav link with gold accent on active state */
function NavLink({
  href,
  label,
  hideOnMd = false,
}: {
  href: string;
  label: string;
  hideOnMd?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white relative group ${hideOnMd ? "hidden md:block" : ""}`}
    >
      {label}
      <span className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#c8a951] scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
    </Link>
  );
}

function Footer() {
  return (
    <footer className="mt-auto bg-[#0a3d2a] py-8 text-center text-sm text-white/70">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <Link href="/how-to-play" className="transition hover:text-[#c8a951]">How to Play</Link>
          <span className="text-white/30">·</span>
          <Link href="/tournaments" className="transition hover:text-[#c8a951]">Tournaments</Link>
          <span className="text-white/30">·</span>
          <Link href="/players" className="transition hover:text-[#c8a951]">Players</Link>
          <span className="text-white/30">·</span>
          <Link href="/leagues" className="transition hover:text-[#c8a951]">Leagues</Link>
          <span className="text-white/30">·</span>
          <Link href="/blog" className="transition hover:text-[#c8a951]">Blog</Link>
          <span className="text-white/30">·</span>
          <Link href="/contact" className="transition hover:text-[#c8a951]">Contact</Link>
        </div>
        <p className="mt-3 text-xs">Fantasy Golf &middot; The Open Championship 2026 &middot; Royal Birkdale</p>
        <p className="mt-1 text-xs text-white/50">For entertainment purposes only. Not affiliated with the R&amp;A, PGA Tour, or DP World Tour.</p>
        <p className="mt-1 text-xs text-white/45">Course images are artistic impressions, not actual photographs.</p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-[#faf9f6] dark:bg-[#0d0f0e]">
        <AuthProvider>
          <PushRegistration />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          {/* Mobile bottom tab bar */}
          <MobileNav />
        </AuthProvider>
      </body>
    </html>
  );
}
