/**
 * StatusRibbon — Diagonal corner ribbon for tournament cards.
 * Place inside a relative-positioned container.
 *
 * Status: "live" | "open" | "upcoming" | "completed"
 */

interface StatusRibbonProps {
  status: string;
}

const RIBBON_MAP: Record<
  string,
  { text: string; cls: string }
> = {
  live: { text: "🔴 LIVE", cls: "ribbon-live" },
  in_progress: { text: "🔴 LIVE", cls: "ribbon-live" },
  open: { text: "OPEN", cls: "ribbon-open" },
  entries_open: { text: "OPEN", cls: "ribbon-open" },
  upcoming: { text: "SOON", cls: "ribbon-upcoming" },
  completed: { text: "DONE", cls: "ribbon-completed" },
};

export default function StatusRibbon({ status }: StatusRibbonProps) {
  const ribbon = RIBBON_MAP[status];
  if (!ribbon) return null;

  return (
    <div className={`status-ribbon ${ribbon.cls}`}>
      {ribbon.text}
    </div>
  );
}
