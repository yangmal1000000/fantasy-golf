"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeaderboardRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000); // 60 seconds

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
