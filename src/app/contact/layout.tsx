import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Fantasy Golf",
  description: "Get in touch with the Fantasy Golf team. Questions, feedback, or support requests welcome.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
