import Link from "next/link";
import { readOperationsCockpit, type OperationsTone } from "@/lib/admin-operations";
import { ADMIN_ROLE_LABELS, hasAdminCapability } from "@/lib/admin-roles";
import { requireAdminCapability } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const [actor, cockpit] = await Promise.all([
    requireAdminCapability("VIEW_DASHBOARD"),
    readOperationsCockpit(),
  ]);
  const canOperate = hasAdminCapability(actor.role, "OPERATE_TOURNAMENT");

  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 pb-24 pt-20 text-zinc-950 dark:bg-[#0b0e0c] dark:text-white sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-[#082f21] p-5 text-white shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d6ba67]">
                Rocket Classic · Operations
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Live operations cockpit
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                A read-only view of the tester funnel, field, scoring and automation.
                Every number identifies its production source and observation time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-black">
                {ADMIN_ROLE_LABELS[actor.role]}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                {cockpit.region} · {formatDateTime(cockpit.generatedAt)}
              </span>
            </div>
          </div>
        </header>

        <section className="mt-5" aria-label="Operational incidents">
          {cockpit.incidents.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                ✓
              </span>
              <div>
                <p className="font-black">No active incident detected</p>
                <p className="mt-1 text-xs opacity-75">
                  This reflects the sources currently wired into the cockpit, not a blanket
                  guarantee that every external service is healthy.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cockpit.incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`rounded-2xl border p-4 text-sm ${incidentClass(incident.tone)}`}
                >
                  <p className="font-black">{incident.title}</p>
                  <p className="mt-1 text-xs opacity-80">{incident.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7">
          <SectionHeading
            eyebrow="Current funnel"
            title="Tester journey"
            detail="Production records only · click a stage to inspect the matching customers"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
            {cockpit.funnel.map((item, index) => {
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      {item.label}
                    </p>
                    <span className="text-[10px] font-black text-[#9b7621]">
                      {index + 1}/6
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-black text-[#083c2a] dark:text-emerald-300">
                    {item.value}
                  </p>
                  <p className="mt-1 min-h-8 text-xs leading-4 text-zinc-500 dark:text-zinc-400">
                    {item.detail}
                  </p>
                  <p className="mt-3 truncate border-t border-zinc-100 pt-2 text-[10px] text-zinc-400 dark:border-zinc-800">
                    Source: {item.source}
                  </p>
                </>
              );
              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="press-feedback rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-[#0a3d2a] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
              <SectionHeading
                eyebrow="System signals"
                title="Health and freshness"
                detail={`Database cockpit read: ${cockpit.databaseLatencyMs} ms`}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cockpit.health.map((item) => {
                  const body = (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-zinc-500 dark:text-zinc-400">
                          {item.label}
                        </p>
                        <ToneDot tone={item.tone} />
                      </div>
                      <p className="mt-2 text-lg font-black">{item.value}</p>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {item.detail}
                      </p>
                      <p className="mt-2 text-[10px] text-zinc-400">Source: {item.source}</p>
                    </>
                  );
                  return item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="press-feedback rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:bg-zinc-950/60 dark:hover:bg-zinc-950"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      key={item.label}
                      className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950/60"
                    >
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="p-5 sm:p-6">
                <SectionHeading
                  eyebrow="Automation"
                  title="Job heartbeat"
                  detail="A missing first run is labelled honestly; viewing this page never creates a run."
                />
              </div>
              {cockpit.jobs.length === 0 ? (
                <div className="border-t border-zinc-100 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
                  No instrumented jobs have run yet. The field and scoring endpoints will
                  register their first heartbeat on their next authorised execution.
                </div>
              ) : (
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                  {cockpit.jobs.map((job) => (
                    <div
                      key={job.key}
                      className="grid gap-3 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ToneDot tone={job.tone} />
                          <p className="font-black">{job.name}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {job.summary ?? `Observed from ${job.source}`}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          Source: {job.source}
                          {job.recordsProcessed !== null
                            ? ` · ${job.recordsProcessed} records`
                            : ""}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs font-black">{job.status}</p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {job.completedAt
                            ? formatDateTime(job.completedAt)
                            : job.lastRunAt
                              ? `Started ${formatDateTime(job.lastRunAt)}`
                              : "Awaiting first run"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
              <SectionHeading eyebrow="Competition state" title="Rocket field" />
              {cockpit.campaign ? (
                <div className="mt-5 space-y-3">
                  <StateLine label="Campaign" value={cockpit.campaign.status} />
                  <StateLine label="Tournament" value={cockpit.campaign.tournamentStatus} />
                  <StateLine label="Current round" value={String(cockpit.campaign.currentRound)} />
                  <StateLine label="Field" value={cockpit.campaign.fieldStatus} />
                  <StateLine
                    label="Version"
                    value={cockpit.campaign.fieldVersion ?? "Not recorded"}
                  />
                  <StateLine
                    label="Hash"
                    value={cockpit.campaign.fieldHashShort ?? "Not recorded"}
                    mono
                  />
                  <StateLine
                    label="Entry closes"
                    value={
                      cockpit.campaign.entryClosesAt
                        ? formatDateTime(cockpit.campaign.entryClosesAt)
                        : "Not recorded"
                    }
                  />
                  <StateLine
                    label="Field updated"
                    value={formatDateTime(cockpit.campaign.fieldUpdatedAt)}
                  />

                  <div className="grid grid-cols-5 gap-1.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    {cockpit.fieldTiers.map((tier) => (
                      <div
                        key={tier.tier}
                        className="rounded-xl bg-zinc-50 px-1 py-2 text-center dark:bg-zinc-950/60"
                      >
                        <p className="text-lg font-black">{tier.count}</p>
                        <p className="mt-0.5 text-[8px] font-bold text-zinc-400">
                          {formatTier(tier.tier)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-red-600">
                  The configured Rocket campaign could not be loaded.
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
              <SectionHeading
                eyebrow="Traceability"
                title="Recent Rocket events"
                detail="Event names and times only; payloads stay hidden."
              />
              <div className="mt-4 space-y-3">
                {cockpit.recentAudit.length === 0 ? (
                  <p className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-500 dark:bg-zinc-950/60">
                    No Rocket audit events recorded.
                  </p>
                ) : (
                  cockpit.recentAudit.map((event) => (
                    <div key={event.id} className="flex gap-3 text-xs">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#b18a2e]" />
                      <div className="min-w-0">
                        <p className="break-words font-black">{humanise(event.action)}</p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
              <SectionHeading eyebrow="Access boundary" title="Safe admin tools" />
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                This cockpit is read-only. Operational controls remain separated and are
                available only to Owner and Operator roles.
              </p>
              <div className="mt-4 grid gap-2">
                <Link
                  href="/admin/customers"
                  className="press-feedback rounded-xl bg-[#0a3d2a] px-4 py-3 text-center text-sm font-black text-white"
                >
                  Inspect customers
                </Link>
                {canOperate ? (
                  <>
                    <Link
                      href="/rocket-control"
                      className="press-feedback rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-black dark:border-zinc-700"
                    >
                      Rocket Control
                    </Link>
                    <Link
                      href="/target-control"
                      className="press-feedback rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-black dark:border-zinc-700"
                    >
                      Target Control
                    </Link>
                  </>
                ) : (
                  <p className="rounded-xl bg-zinc-50 p-3 text-center text-xs text-zinc-500 dark:bg-zinc-950/60">
                    Your {ADMIN_ROLE_LABELS[actor.role].toLowerCase()} role cannot run
                    tournament actions.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>

        <p className="mt-7 text-center text-xs text-zinc-400">
          Read-only operations cockpit · no monitoring request modifies customers,
          drafts, teams, field state or scores.
        </p>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#98751f] dark:text-[#d6ba67]">
        {eyebrow}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        {detail && <p className="max-w-xl text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>}
      </div>
    </div>
  );
}

function StateLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-right font-black ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ToneDot({ tone }: { tone: OperationsTone }) {
  const colour =
    tone === "healthy"
      ? "bg-emerald-500"
      : tone === "critical"
        ? "bg-red-500"
        : tone === "warning"
          ? "bg-amber-500"
          : "bg-blue-400";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour}`} />;
}

function incidentClass(tone: "warning" | "critical" | "waiting") {
  if (tone === "critical") {
    return "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";
  }
  return "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200";
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function formatTier(tier: string) {
  return (
    {
      T1_10: "1–10",
      T11_20: "11–20",
      T21_30: "21–30",
      T31_50: "31–50",
      T51_PLUS: "51+",
    }[tier] ?? tier
  );
}

function humanise(action: string) {
  return action
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
