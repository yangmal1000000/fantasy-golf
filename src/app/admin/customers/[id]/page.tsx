import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdminCustomerDetail } from "@/lib/admin-customers";
import { hasAdminCapability, maskAdminEmail } from "@/lib/admin-roles";
import { requireAdminCapability } from "@/lib/admin-session";
import { CustomerAccessBadge, CustomerStageBadge } from "../CustomerBadges";
import CustomerPiiReveal from "./CustomerPiiReveal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [actor, customer] = await Promise.all([
    requireAdminCapability("VIEW_CUSTOMERS"),
    readAdminCustomerDetail(id),
  ]);
  if (!customer) notFound();
  const canRevealPii = hasAdminCapability(actor.role, "REVEAL_CUSTOMER_PII");

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 pb-24 pt-20 text-zinc-900 dark:bg-[#0d0f0e] dark:text-white sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/customers"
          className="inline-flex text-sm font-black text-[#0a3d2a] hover:underline dark:text-green-400"
        >
          ← Customers
        </Link>

        <header className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {customer.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={customer.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0a3d2a] text-xl font-black text-white">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6b1f] dark:text-[#d7bc6a]">
                  Admin customer record · read-only
                </p>
                <h1 className="mt-1 truncate text-3xl font-black tracking-tight">{customer.name}</h1>
                <CustomerPiiReveal
                  customerId={customer.id}
                  maskedEmail={maskAdminEmail(customer.email)}
                  canReveal={canRevealPii}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <CustomerStageBadge stage={customer.stage} />
                  <CustomerAccessBadge access={customer.access} />
                  {customer.isDemo && (
                    <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-black text-white dark:bg-white dark:text-zinc-900">
                      Demo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 text-xs leading-5 text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <p><strong>Created:</strong> {formatDateTime(customer.createdAt)}</p>
              <p><strong>Last recorded:</strong> {formatDateTime(customer.lastRecordedAt)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide">Not a session/online indicator</p>
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Teams" value={customer.teamCount} />
          <Metric label="Leagues" value={customer.leagueCount} />
          <Metric label="Notifications" value={customer.notificationCount} />
          <Metric label="Saved squads" value={customer.savedTeams.length} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <SectionHeading
                eyebrow="Current test flight"
                title={customer.rocket.campaignName ?? "Rocket Classic"}
                detail="Verified milestones only; no draft player choices are exposed here."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StateCard
                  label="Rocket access"
                  value={
                    customer.rocket.memberActive === null
                      ? "Not joined"
                      : customer.rocket.memberActive
                        ? "Active"
                        : "Deactivated"
                  }
                  date={customer.rocket.memberJoinedAt}
                />
                <StateCard
                  label="Target"
                  value={customer.rocket.targetSubmittedAt ? "Complete" : "Not complete"}
                  date={customer.rocket.targetSubmittedAt}
                />
                <StateCard
                  label="Test Pass"
                  value={customer.passStatus ?? "Not unlocked"}
                  date={customer.rocket.passUnlockedAt}
                />
                <StateCard
                  label="Provisional draft"
                  value={customer.draftSaved ? "Saved" : "Not saved"}
                  date={customer.rocket.draftUpdatedAt}
                  detail={
                    customer.rocket.draftFieldVersion
                      ? `Field ${customer.rocket.draftFieldVersion}`
                      : null
                  }
                />
                <StateCard
                  label="Official team"
                  value={customer.officialTeam ? "Created" : "Awaiting final field"}
                  date={customer.rocket.passRedeemedAt}
                  wide
                />
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <SectionHeading
                eyebrow="Customer history"
                title="Recorded timeline"
                detail="Account, Target and Rocket audit events. Raw payloads and draft choices are intentionally hidden."
              />
              <div className="mt-5">
                {customer.timeline.map((event, index) => (
                  <div key={event.id} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 h-3 w-3 rounded-full ${
                          event.tone === "success"
                            ? "bg-green-500"
                            : event.tone === "warning"
                              ? "bg-amber-500"
                              : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      />
                      {index < customer.timeline.length - 1 && (
                        <span className="min-h-8 w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                      )}
                    </div>
                    <div className="pb-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-black text-zinc-900 dark:text-white">
                          {event.label}
                        </p>
                        <time className="shrink-0 text-[11px] text-zinc-400">
                          {formatDateTime(event.createdAt)}
                        </time>
                      </div>
                      {event.detail && (
                        <p className="mt-1 text-xs text-zinc-500">{event.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <SectionHeading eyebrow="Entries" title="Teams" />
              <div className="mt-4 space-y-3">
                {customer.teams.length === 0 ? (
                  <EmptyState>No official or legacy teams recorded.</EmptyState>
                ) : (
                  customer.teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/tournaments/${team.tournamentId}/teams/${team.id}`}
                      className="press-feedback block rounded-2xl border border-zinc-200 p-4 hover:border-[#0a3d2a] dark:border-zinc-700"
                    >
                      <p className="font-black text-zinc-900 dark:text-white">{team.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{team.tournamentName}</p>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        {team.selectionCount} golfers · {formatDateTime(team.createdAt)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <SectionHeading eyebrow="Community" title="Leagues and saved squads" />
              <div className="mt-4 space-y-3 text-sm">
                {customer.leagues.map((league) => (
                  <div key={league.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                    <p className="font-black">{league.name}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Joined {formatDateTime(league.joinedAt)}
                    </p>
                  </div>
                ))}
                {customer.savedTeams.map((team) => (
                  <div key={team.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                    <p className="font-black">
                      {team.name} {team.isDefault ? "· Default" : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {team.playerCount} golfers · Updated {formatDateTime(team.updatedAt)}
                    </p>
                  </div>
                ))}
                {customer.leagues.length === 0 && customer.savedTeams.length === 0 && (
                  <EmptyState>No leagues or reusable squads recorded.</EmptyState>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <SectionHeading
                eyebrow="Communications"
                title="Latest notifications"
                detail={`${customer.notificationCount} total · latest 25 shown`}
              />
              <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {customer.notifications.length === 0 ? (
                  <EmptyState>No notifications recorded.</EmptyState>
                ) : (
                  customer.notifications.map((notification) => (
                    <div key={notification.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black">{notification.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            notification.read
                              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          }`}
                        >
                          {notification.read ? "Read" : "Unread"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {notification.type} · {formatDateTime(notification.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Read-only Customer V1 · no export, support notes, account actions or mutable controls.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#0a3d2a] dark:text-green-400">{value}</p>
    </div>
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
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6b1f] dark:text-[#d7bc6a]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      {detail && <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>}
    </div>
  );
}

function StateCard({
  label,
  value,
  date,
  detail,
  wide = false,
}: {
  label: string;
  value: string;
  date: Date | null;
  detail?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950/60 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 font-black text-zinc-900 dark:text-white">{value}</p>
      {date && <p className="mt-1 text-[11px] text-zinc-500">{formatDateTime(date)}</p>}
      {detail && <p className="mt-1 break-all text-[10px] text-zinc-400">{detail}</p>}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-500 dark:bg-zinc-950/60">
      {children}
    </p>
  );
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  });
}
