import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Achievements — Fantasy Golf",
  description: "Track your fantasy golf badges, milestones, and trophy room progress.",
};

export default function AchievementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
