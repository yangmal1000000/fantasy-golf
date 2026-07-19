import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refer a Friend — Fantasy Golf",
  description: "Invite friends to Fantasy Golf and earn 50% off entry vouchers when they enter their first team.",
};

export default function ReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
