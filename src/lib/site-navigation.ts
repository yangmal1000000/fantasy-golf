export const ROCKET_BETA_PATH = "/tournaments/rocket-classic";

export const SITE_NAV_LINKS = [
  { href: ROCKET_BETA_PATH, label: "Rocket Beta" },
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
  if (href === "/tournaments") {
    return matchesPath(pathname, href) && !matchesPath(pathname, ROCKET_BETA_PATH);
  }

  return matchesPath(pathname, href);
}
