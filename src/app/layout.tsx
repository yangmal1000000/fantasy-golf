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
import NavLinks from "@/components/NavLinks";
import { GolfFlagIcon } from "@/components/icons";

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
  title: "Fantasy Golf",
  description: "Pick your dream team. £15 entry, winner takes all.",
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
    title: "Fantasy Golf",
    description: "Pick your dream team. £15 entry, winner takes all.",
    url: "https://fantasy-golf-phi.vercel.app",
    siteName: "Fantasy Golf",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy Golf",
    description: "Pick your dream team. £15 entry, winner takes all.",
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
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c8a951] text-[#0a3d2a]">
            <GolfFlagIcon className="h-4 w-4" />
          </span>
          <span className="hidden xs:inline sm:inline">Fantasy Golf</span>
        </Link>

        {/* Desktop Nav links */}
        <NavLinks />

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
        <p className="mt-3 text-xs">Fantasy Golf &middot; Major Sweepstake</p>
        <p className="mt-1 text-xs text-white/65">For entertainment purposes only. Not affiliated with the R&amp;A, PGA Tour, or DP World Tour.</p>
        <p className="mt-1 text-xs text-white/60">Course images are artistic impressions, not actual photographs.</p>
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
