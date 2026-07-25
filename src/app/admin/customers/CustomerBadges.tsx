import {
  CUSTOMER_ACCESS_LABELS,
  CUSTOMER_STAGE_LABELS,
  type CustomerAccess,
  type CustomerStage,
} from "@/lib/admin-customer-core";

const STAGE_STYLES: Record<CustomerStage, string> = {
  official_team: "border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300",
  draft_saved: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
  test_pass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  target_complete: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300",
  rocket_joined: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  account_only: "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

const ACCESS_STYLES: Record<CustomerAccess, string> = {
  owner: "bg-[#0a3d2a] text-white",
  active: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  deactivated: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  revoked: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  account: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function CustomerStageBadge({ stage }: { stage: CustomerStage }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${STAGE_STYLES[stage]}`}>
      {CUSTOMER_STAGE_LABELS[stage]}
    </span>
  );
}

export function CustomerAccessBadge({ access }: { access: CustomerAccess }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${ACCESS_STYLES[access]}`}>
      {CUSTOMER_ACCESS_LABELS[access]}
    </span>
  );
}
