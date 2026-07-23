"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ControlData = {
  campaign: {
    name: string;
    status: string;
    entryClosesAt: string | null;
    entryDeadlineConfirmed: boolean;
    fieldVersion: string | null;
    fieldHash: string | null;
    fieldFrozenAt: string | null;
    fieldCount: number;
    results: unknown;
    resultsHash: string | null;
    finalizedAt: string | null;
  };
  members: Array<{
    id: string;
    email: string;
    displayName: string | null;
    active: boolean;
    linked: boolean;
    joinedAt: string;
    targetSubmittedAt: string | null;
    passStatus: string | null;
    passUnlockedAt: string | null;
    teamId: string | null;
  }>;
  teams: Array<{
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    createdAt: string;
  }>;
  auditEvents: Array<{
    id: string;
    actorEmail: string | null;
    action: string;
    payload: unknown;
    createdAt: string;
  }>;
};

export default function RocketControlClient() {
  const [data, setData] = useState<ControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/rocket-beta-control", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load Rocket control");
        }
        return body as ControlData;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load Rocket control");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function mutate(action: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rocket-beta-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update Rocket beta");
      setData(body as ControlData);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update Rocket beta");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const campaign = data?.campaign;

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-16 dark:bg-[#0d0f0e]">
      <header className="bg-[#071f16] text-white">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7bc6a]">
            Coordinator only · no-payment rehearsal
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Rocket beta control</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
            Watch signed-up accounts move through Target → pass → team,
            pause entry and seal the deterministic final beta result.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            <Link href="/target-control" className="rounded-lg bg-white/10 px-3 py-2">
              Target control
            </Link>
            <Link href="/tournaments/rocket-classic" className="rounded-lg bg-white/10 px-3 py-2">
              Rocket hub
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-7">
        {loading && <ControlCard title="Loading campaign…" />}
        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </p>
        )}

        {campaign && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Metric
                label="Campaign"
                value={campaign.status}
                detail={
                  campaign.entryClosesAt
                    ? campaign.entryDeadlineConfirmed
                      ? `Locks ${new Date(campaign.entryClosesAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}`
                      : `Provisional server lock ${new Date(campaign.entryClosesAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · official first tee pending`
                    : "No lock configured"
                }
              />
              <Metric
                label="Field snapshot"
                value={`${campaign.fieldCount} players`}
                detail={
                  campaign.fieldFrozenAt
                    ? `Frozen · ${campaign.fieldVersion}`
                    : `Provisional · ${campaign.fieldVersion ?? "not staged"}`
                }
              />
              <Metric
                label="Progress"
                value={`${data.members.filter((member) => member.teamId).length}/${data.members.length} teams`}
                detail={`${data.members.filter((member) => member.passStatus).length} Test Passes`}
              />
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                    Entry state
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
                    {campaign.status === "OPEN" ? "Campaign open" : "Campaign paused"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    A provisional field never opens the team picker. The field
                    must also have a final frozen hash.
                  </p>
                </div>
                {!campaign.finalizedAt && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mutate("set_status", {
                        status: campaign.status === "OPEN" ? "PAUSED" : "OPEN",
                      })
                    }
                    className="rounded-xl border border-[#0a3d2a] px-4 py-2.5 text-sm font-black text-[#0a3d2a] disabled:opacity-40 dark:border-green-500 dark:text-green-400"
                  >
                    {campaign.status === "OPEN" ? "Pause campaign" : "Open campaign"}
                  </button>
                )}
              </div>
              <p className="mt-4 break-all rounded-xl bg-zinc-50 p-3 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800/70">
                Field hash: {campaign.fieldHash ?? "Not staged"}
              </p>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Participant registry
              </p>
              <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
                Open verified-account signup
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                Every verified Google account joins automatically on its first
                Rocket or Target visit. You can still block an account before
                it confirms a team.
              </p>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/70">
                    <tr>
                      <th className="px-4 py-3">Tester</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Test Pass</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {data.members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-4 py-3">
                          <p className="font-black text-zinc-900 dark:text-white">
                            {member.displayName ?? "Signed-up participant"}
                          </p>
                          <p className="mt-0.5 text-zinc-500">{member.email}</p>
                        </td>
                        <td className="px-4 py-3">{member.linked ? "Linked" : "Awaiting sign-in"}</td>
                        <td className="px-4 py-3">{member.targetSubmittedAt ? "Locked" : "Not started"}</td>
                        <td className="px-4 py-3">{member.passStatus ?? "Locked"}</td>
                        <td className="px-4 py-3">
                          {member.teamId ? (
                            <Link
                              href={`/tournaments/rocket-classic/teams/${member.teamId}`}
                              className="font-bold text-[#0a3d2a] underline dark:text-green-400"
                            >
                              Confirmed
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={busy || Boolean(member.teamId)}
                            onClick={() =>
                              mutate("set_member_active", {
                                memberId: member.id,
                                active: !member.active,
                              })
                            }
                            className={`rounded-lg px-3 py-1.5 font-black disabled:opacity-30 ${member.active ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"}`}
                          >
                            {member.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Final beta result
              </p>
              <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
                {campaign.finalizedAt ? "Result sealed" : "Awaiting completed event"}
              </h2>
              {campaign.finalizedAt ? (
                <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
                  <p className="font-black">
                    Finalized {new Date(campaign.finalizedAt).toLocaleString()}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">{campaign.resultsHash}</p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || !campaign.fieldFrozenAt || data.teams.length === 0}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Seal the deterministic Rocket beta result? This cannot be reopened.",
                      )
                    ) {
                      void mutate("finalize");
                    }
                  }}
                  className="mt-5 rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white disabled:opacity-35"
                >
                  Finalize completed beta
                </button>
              )}
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Audit history
              </p>
              <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.auditEvents.map((event) => (
                  <div key={event.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[180px_1fr_220px]">
                    <time className="text-zinc-500">{new Date(event.createdAt).toLocaleString()}</time>
                    <span className="font-black text-zinc-800 dark:text-zinc-200">{event.action}</span>
                    <span className="truncate text-zinc-400">{event.actorEmail ?? "system"}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-black text-[#0a3d2a] dark:text-green-400">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function ControlCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      {title}
    </div>
  );
}
