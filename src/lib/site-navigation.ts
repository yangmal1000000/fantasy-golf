export const ROCKET_BETA_PATH = "/tournaments/rocket-classic";
export const NEXT_EVENT_PATH = "/next-event";

export const SITE_NAV_LINKS = [
  { href: NEXT_EVENT_PATH, label: "Next Test" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/players", label: "Players" },
  { href: "/my-teams", label: "My Teams" },
  { href: "/stats", label: "Stats" },
  { href: "/leagues", label: "Leagues" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/how-to-play", label: "How to Play" },
] as const;

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isSiteNavItemActive(pathname: string, href: string) {
  return matchesPath(pathname, href);
}
