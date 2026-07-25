import Link from "next/link";
import {
  CUSTOMER_ACCESS_LABELS,
  CUSTOMER_STAGE_LABELS,
  CUSTOMER_STAGE_OPTIONS,
  type CustomerAccess,
  type CustomerStage,
} from "@/lib/admin-customer-core";
import {
  readAdminCustomerOverview,
  type AdminCustomerSummary,
} from "@/lib/admin-customers";
import { maskAdminEmail } from "@/lib/admin-roles";
import { CustomerAccessBadge, CustomerStageBadge } from "./CustomerBadges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const ACCESS_OPTIONS = ["owner", "active", "deactivated", "revoked", "account"] as const;

type SearchParams = {
  q?: string;
  stage?: string;
  access?: string;
  page?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const overview = await readAdminCustomerOverview();
  const q = params.q?.trim().toLowerCase() ?? "";
  const stage = isCustomerStage(params.stage) ? params.stage : null;
  const access = isCustomerAccess(params.access) ? params.access : null;
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const filtered = overview.customers
    .filter((customer) => {
      if (
        q &&
        !customer.name.toLowerCase().includes(q) &&
        !customer.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (stage && customer.stage !== stage) return false;
      if (access && customer.access !== access) return false;
      return true;
    })
    .sort((left, right) => right.lastRecordedAt.getTime() - left.lastRecordedAt.getTime());
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageCustomers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 pb-24 pt-20 text-zinc-900 dark:bg-[#0d0f0e] dark:text-white sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b1f] dark:text-[#d7bc6a]">
              Admin only · read-only
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Customers</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              One truthful view of account → Target → Test Pass → saved draft → official team.
              No customer data can be changed from this screen.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            As of {formatDateTime(overview.generatedAt)}
          </div>
        </header>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Metric label="Accounts" value={overview.accounts} detail={`${overview.demoAccounts} demo`} />
          <Metric label="Rocket testers" value={overview.rocketParticipants} detail={overview.campaignName ?? "Current campaign"} />
          <Metric label="Target complete" value={overview.targetComplete} detail="Locked submissions" />
          <Metric label="Test Passes" value={overview.testPasses} detail="Any pass state" />
          <Metric label="Drafts saved" value={overview.draftsSaved} detail="Provisional teams" />
          <Metric label="Official teams" value={overview.officialTeams} detail="Created Team rows" />
        </section>

        {overview.unlinkedRocketMembers > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300">
            {overview.unlinkedRocketMembers} Rocket participant record
            {overview.unlinkedRocketMembers === 1 ? " is" : "s are"} not linked to a current User
            record. It is excluded from the customer list until identity is reconciled.
          </div>
        )}

        <form
          action="/admin/customers"
          className="mt-7 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]"
        >
          <label className="block">
            <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Name or email"
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#0a3d2a] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
              Customer stage
            </span>
            <select
              name="stage"
              defaultValue={stage ?? ""}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#0a3d2a] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">All stages</option>
              {CUSTOMER_STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CUSTOMER_STAGE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
              Access
            </span>
            <select
              name="access"
              defaultValue={access ?? ""}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#0a3d2a] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">All access</option>
              {ACCESS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CUSTOMER_ACCESS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="press-feedback flex-1 rounded-xl bg-[#0a3d2a] px-4 py-2.5 text-sm font-black text-white"
            >
              Filter
            </button>
            {(q || stage || access) && (
              <Link
                href="/admin/customers"
                className="press-feedback rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <p>
            Showing {pageCustomers.length} of {filtered.length} matching customer
            {filtered.length === 1 ? "" : "s"}
          </p>
          <p>Demo and legacy records are labelled, never silently mixed.</p>
        </div>

        <section className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {pageCustomers.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm font-black text-zinc-700 dark:text-zinc-200">
                No customers match these filters.
              </p>
              <Link
                href="/admin/customers"
                className="mt-3 inline-flex text-sm font-bold text-[#0a3d2a] underline dark:text-green-400"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <tr>
                      <th className="px-5 py-3 font-black">Customer</th>
                      <th className="px-4 py-3 font-black">Stage</th>
                      <th className="px-4 py-3 font-black">Access</th>
                      <th className="px-4 py-3 font-black">Rocket state</th>
                      <th className="px-4 py-3 font-black">Last recorded</th>
                      <th className="px-5 py-3 text-right font-black">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {pageCustomers.map((customer) => (
                      <CustomerRow key={customer.id} customer={customer} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 md:hidden">
                {pageCustomers.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} />
                ))}
              </div>
            </>
          )}
        </section>

        {pageCount > 1 && (
          <nav className="mt-5 flex items-center justify-between" aria-label="Customer pages">
            <PageLink
              page={page - 1}
              disabled={page === 1}
              label="← Previous"
              params={params}
            />
            <span className="text-xs font-bold text-zinc-500">
              Page {page} of {pageCount}
            </span>
            <PageLink
              page={page + 1}
              disabled={page === pageCount}
              label="Next →"
              params={params}
            />
          </nav>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#0a3d2a] dark:text-green-400">{value}</p>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}

function CustomerRow({ customer }: { customer: AdminCustomerSummary }) {
  return (
    <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar customer={customer} />
          <div className="min-w-0">
            <p className="truncate font-black text-zinc-900 dark:text-white">{customer.name}</p>
            <p className="truncate text-xs text-zinc-500">{maskAdminEmail(customer.email)}</p>
            <CustomerKind customer={customer} />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <CustomerStageBadge stage={customer.stage} />
      </td>
      <td className="px-4 py-4">
        <CustomerAccessBadge access={customer.access} />
      </td>
      <td className="px-4 py-4 text-xs leading-5 text-zinc-500">
        <p>Target {customer.targetComplete ? "complete" : "—"}</p>
        <p>Pass {customer.passStatus ?? "—"} · Draft {customer.draftSaved ? "saved" : "—"}</p>
      </td>
      <td className="px-4 py-4 text-xs text-zinc-500">
        {formatDateTime(customer.lastRecordedAt)}
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/admin/customers/${customer.id}`}
          className="press-feedback inline-flex rounded-xl border border-[#0a3d2a] px-3 py-2 text-xs font-black text-[#0a3d2a] dark:border-green-500 dark:text-green-400"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function CustomerCard({ customer }: { customer: AdminCustomerSummary }) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <Avatar customer={customer} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-zinc-900 dark:text-white">{customer.name}</p>
          <p className="truncate text-xs text-zinc-500">{maskAdminEmail(customer.email)}</p>
          <CustomerKind customer={customer} />
        </div>
        <Link
          href={`/admin/customers/${customer.id}`}
          className="press-feedback rounded-xl border border-[#0a3d2a] px-3 py-2 text-xs font-black text-[#0a3d2a] dark:border-green-500 dark:text-green-400"
        >
          View
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CustomerStageBadge stage={customer.stage} />
        <CustomerAccessBadge access={customer.access} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950/60">
        <p>Target: <strong>{customer.targetComplete ? "Complete" : "—"}</strong></p>
        <p>Pass: <strong>{customer.passStatus ?? "—"}</strong></p>
        <p>Draft: <strong>{customer.draftSaved ? "Saved" : "—"}</strong></p>
        <p>Teams: <strong>{customer.teamCount}</strong></p>
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">
        Last recorded {formatDateTime(customer.lastRecordedAt)}
      </p>
    </article>
  );
}

function Avatar({ customer }: { customer: AdminCustomerSummary }) {
  if (customer.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customer.avatar}
        alt=""
        referrerPolicy="no-referrer"
        className="h-10 w-10 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a3d2a] text-sm font-black text-white">
      {customer.name.charAt(0).toUpperCase()}
    </span>
  );
}

function CustomerKind({ customer }: { customer: AdminCustomerSummary }) {
  return (
    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
      {customer.isDemo
        ? "Demo account"
        : customer.rocketMember
          ? "Rocket tester"
          : customer.isOwner
            ? "Owner account"
            : "Legacy / other"}
    </p>
  );
}

function PageLink({
  page,
  disabled,
  label,
  params,
}: {
  page: number;
  disabled: boolean;
  label: string;
  params: SearchParams;
}) {
  if (disabled) {
    return (
      <span className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
        {label}
      </span>
    );
  }
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.stage) next.set("stage", params.stage);
  if (params.access) next.set("access", params.access);
  next.set("page", String(page));
  return (
    <Link
      href={`/admin/customers?${next.toString()}`}
      className="press-feedback rounded-xl border border-zinc-300 px-4 py-2 text-sm font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
    >
      {label}
    </Link>
  );
}

function isCustomerStage(value: string | undefined): value is CustomerStage {
  return CUSTOMER_STAGE_OPTIONS.includes(value as CustomerStage);
}

function isCustomerAccess(value: string | undefined): value is CustomerAccess {
  return ACCESS_OPTIONS.includes(value as (typeof ACCESS_OPTIONS)[number]);
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
