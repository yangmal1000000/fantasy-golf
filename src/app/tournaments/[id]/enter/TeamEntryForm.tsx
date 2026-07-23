"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIER_CONFIG, TIER_ORDER, formatGBP } from "@/lib/ui";
import SelectionWheel from "@/components/SelectionWheel";
import Confetti from "@/components/Confetti";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";

interface TierPlayer {
  tournamentPlayerId: string;
  playerId: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  dataGolfRank: number | null;
  tier: string;
}

interface SavedTeamPreview {
  id: string;
  name: string;
  players: {
    playerId: string;
    tier: string;
    player: {
      id: string;
      name: string;
    };
  }[];
}

interface TeamEntryFormProps {
  tournamentId: string;
  entryFee: number;
  betaMode?: boolean;
  playersByTier: Record<string, TierPlayer[]>;
  savedTeams?: SavedTeamPreview[];
}

export default function TeamEntryForm({
  tournamentId,
  entryFee,
  betaMode = false,
  playersByTier,
  savedTeams = [],
}: TeamEntryFormProps) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [openTiers, setOpenTiers] = useState<Set<string>>(new Set(TIER_ORDER));
  const [mode, setMode] = useState<"fresh" | "saved">(
    savedTeams.length > 0 ? "saved" : "fresh",
  );
  const [missingSlots, setMissingSlots] = useState<
    { tier: string; playerName: string }[]
  >([]);
  const [appliedTeamName, setAppliedTeamName] = useState<string | null>(null);

  const selectedCount = Object.keys(selections).length;
  const allTiersFilled = TIER_ORDER.every((t) => selections[t]);

  function toggleSelect(tier: string, tournamentPlayerId: string) {
    setSelections((prev) => {
      if (prev[tier] === tournamentPlayerId) {
        const next = { ...prev };
        delete next[tier];
        return next;
      }
      return { ...prev, [tier]: tournamentPlayerId };
    });
  }

  function toggleTier(tier: string) {
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  // Apply a saved team template — auto-fills picks, tracks missing players
  function applySavedTeam(team: SavedTeamPreview) {
    const newSelections: Record<string, string> = {};
    const missing: { tier: string; playerName: string }[] = [];

    for (const slot of team.players) {
      const tierPlayers = playersByTier[slot.tier] || [];
      const match = tierPlayers.find((p) => p.playerId === slot.playerId);
      if (match) {
        newSelections[slot.tier] = match.tournamentPlayerId;
      } else {
        missing.push({ tier: slot.tier, playerName: slot.player.name });
      }
    }

    setSelections(newSelections);
    setMissingSlots(missing);
    setTeamName(team.name);
    setAppliedTeamName(team.name);
    // Switch to fresh mode so user can review/tweak picks
    setMode("fresh");
    // Expand all tiers so the user can see filled picks and pick replacements
    setOpenTiers(new Set(TIER_ORDER));
  }

  // Clear missing slots warning when user manually selects a replacement
  function handleTierSelect(tier: string, tournamentPlayerId: string) {
    toggleSelect(tier, tournamentPlayerId);
    setMissingSlots((prev) => prev.filter((s) => s.tier !== tier));
  }

  const [submittedTeamId, setSubmittedTeamId] = useState<string | null>(null);
  const [saveTemplateState, setSaveTemplateState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Build player data for template saving
  const submittedPlayers = TIER_ORDER.filter((t) => t !== "UNRANKED").map(
    (tier) => {
      const tpId = selections[tier];
      const tierPlayers = playersByTier[tier] || [];
      const player = tierPlayers.find((p) => p.tournamentPlayerId === tpId);
      return {
        playerId: player?.playerId ?? "",
        tier,
      };
    },
  ).filter((p) => p.playerId);

  async function handleSaveTemplate() {
    setSaveTemplateState("saving");
    try {
      const res = await fetch("/api/saved-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          players: submittedPlayers,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSaveTemplateState("saved");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save template");
      setSaveTemplateState("idle");
    }
  }

  async function handleSubmit() {
    setError(null);

    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    if (!allTiersFilled) {
      setError("You must pick one player from each tier");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          selections: Object.values(selections),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create team");
      }

      const data = await res.json();
      setSubmittedTeamId(data.teamId);
      setShowConfetti(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const hasSavedTeams = savedTeams.length > 0;

  return (
    <div className="pb-24 sm:pb-0">
      {/* Confetti burst on success */}
      {showConfetti && <Confetti />}

      {/* Success screen with save-as-template prompt */}
      {showConfetti && submittedTeamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="mx-auto max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-[#0a3d2a] dark:text-green-400">
              {betaMode ? "Rocket Team Confirmed!" : "Team Submitted!"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {betaMode
                ? "Your Test Pass is now locked to this five-player team."
                : "Good luck out there!"}
            </p>

            {/* Save as template prompt */}
            <div className="mt-5 rounded-xl border border-[#c8a951]/30 bg-[#c8a951]/5 p-4 text-left">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Save this team as a template?
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Reuse these picks for future tournaments in one click.
              </p>
              {saveTemplateState === "saved" ? (
                <p className="mt-3 text-center text-sm font-semibold text-green-600">
                  ✓ Saved as template!
                </p>
              ) : (
                <button
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateState === "saving"}
                  className="mt-3 w-full rounded-xl bg-[#c8a951] py-2.5 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#d4b76a] disabled:opacity-50"
                >
                  {saveTemplateState === "saving"
                    ? "Saving..."
                    : "⭐ Save as Template"}
                </button>
              )}
            </div>

            {/* Continue button */}
            <button
              onClick={() =>
                router.push(`/tournaments/${tournamentId}/teams/${submittedTeamId}`)
              }
              className="mt-4 w-full rounded-xl bg-[#0a3d2a] py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
            >
              View My Team →
            </button>
          </div>
        </div>
      )}

      {/* Mode toggle: Pick Fresh vs Use Saved Team */}
      {hasSavedTeams && (
        <div className="mb-5">
          <div className="flex gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
            <button
              onClick={() => setMode("saved")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "saved"
                  ? "bg-white dark:bg-zinc-700 text-[#0a3d2a] dark:text-green-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              ⭐ Use Saved Team
            </button>
            <button
              onClick={() => setMode("fresh")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "fresh"
                  ? "bg-white dark:bg-zinc-700 text-[#0a3d2a] dark:text-green-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              ✏️ Pick Fresh
            </button>
          </div>
        </div>
      )}

      {/* Saved team picker mode */}
      {mode === "saved" && hasSavedTeams ? (
        <div>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Select a saved team template to auto-fill your picks. You can tweak
            any selections before submitting.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedTeams.map((team) => {
              const sortedPlayers = [...team.players].sort(
                (a, b) =>
                  TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
              );
              return (
                <button
                  key={team.id}
                  onClick={() => applySavedTeam(team)}
                  className="group rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-left transition hover:border-[#0a3d2a] hover:shadow-md dark:hover:border-green-600"
                >
                  <h3 className="mb-3 font-bold text-[#0a3d2a] dark:text-green-400">
                    {team.name}
                  </h3>
                  <div className="space-y-1.5">
                    {sortedPlayers.map((slot) => {
                      const config = TIER_CONFIG[slot.tier];
                      const lastName = slot.player.name
                        .split(" ")
                        .slice(-1)[0];
                      // Check if this player is in the tournament field
                      const tierPlayers = playersByTier[slot.tier] || [];
                      const inField = tierPlayers.some(
                        (p) => p.playerId === slot.playerId,
                      );
                      return (
                        <div
                          key={slot.playerId}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: config?.gradFrom ?? "#6b7280",
                            }}
                          />
                          <span
                            className={
                              inField
                                ? "text-zinc-700 dark:text-zinc-300"
                                : "text-orange-500 line-through"
                            }
                          >
                            {slot.player.name}
                          </span>
                          {!inField && (
                            <span className="text-xs text-orange-400">
                              (not in field)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#0a3d2a] opacity-0 transition group-hover:opacity-100 dark:text-green-400">
                    Click to apply →
                  </p>
                </button>
              );
            })}
          </div>

          {/* Back to fresh picking */}
          <button
            onClick={() => setMode("fresh")}
            className="mt-5 text-sm font-medium text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Or pick players from scratch →
          </button>
        </div>
      ) : (
        <>
          {/* Selection progress — sticky bar with wheel */}
          <div className="sticky top-[52px] z-30 -mx-4 mb-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-4 py-2.5 backdrop-blur sm:top-[57px] sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <SelectionWheel selectedCount={selectedCount} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
                    {selectedCount === 5
                      ? "Team Complete!"
                      : `${selectedCount}/5 Selected`}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {TIER_ORDER.filter((t) => t !== "UNRANKED").map((t) => (
                      <div
                        key={t}
                        className={`h-2 w-6 rounded-full transition sm:w-8 ${
                          selections[t]
                            ? "bg-[#0a3d2a] dark:bg-green-600"
                            : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Submit button — hidden on mobile */}
              <button
                onClick={handleSubmit}
                disabled={!allTiersFilled || submitting || showConfetti}
                className="hidden rounded-full bg-[#c8a951] px-6 py-2 text-sm font-bold text-[#1a1a1a] shadow transition enabled:hover:bg-[#d4b76a] disabled:cursor-not-allowed disabled:opacity-40 sm:block"
              >
                {submitting
                  ? "Submitting..."
                  : showConfetti
                    ? "✓ Submitted!"
                    : "Submit Team →"}
              </button>
            </div>
          </div>

          {/* Missing players warning */}
          {missingSlots.length > 0 && (
            <div className="mb-5 rounded-xl border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/30">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-400">
                ⚠️ {missingSlots.length} player
                {missingSlots.length > 1 ? "s" : ""} from &ldquo;
                {appliedTeamName}&rdquo; {missingSlots.length > 1 ? "are" : " is"}{" "}
                not in this tournament&rsquo;s field:
              </p>
              <ul className="mt-2 space-y-1">
                {missingSlots.map((slot) => {
                  const config = TIER_CONFIG[slot.tier];
                  return (
                    <li
                      key={slot.tier}
                      className="text-sm text-orange-700 dark:text-orange-300"
                    >
                      <span className="font-semibold">{slot.playerName}</span>{" "}
                      ({config?.short}) — pick a replacement below
                      {!selections[slot.tier] && (
                        <span className="ml-1 text-orange-500">← needed</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Applied team indicator */}
          {appliedTeamName && missingSlots.length === 0 && selectedCount === 5 && (
            <div className="mb-5 rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Applied &ldquo;{appliedTeamName}&rdquo; — all 5 players are in
                the field. Tweak any pick or submit below.
              </p>
            </div>
          )}

          {/* Team name */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Fairway Finders FC"
              maxLength={40}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-base outline-none focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 dark:text-white"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Tier sections — accordion on mobile */}
          <div className="space-y-3 sm:space-y-8">
            {TIER_ORDER.filter((t) => t !== "UNRANKED").map((tier) => {
              const config = TIER_CONFIG[tier];
              const players = playersByTier[tier] || [];
              const selectedId = selections[tier];
              const isOpen = openTiers.has(tier);
              const selectedPlayer = players.find(
                (p) => p.tournamentPlayerId === selectedId,
              );
              const needsReplacement = missingSlots.some(
                (s) => s.tier === tier,
              );

              return (
                <div
                  key={tier}
                  className={`overflow-hidden rounded-xl border sm:border-0 sm:overflow-visible ${
                    needsReplacement
                      ? "border-orange-300 ring-1 ring-orange-200"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {/* Tier header */}
                  <div className="sm:mb-3 sm:flex sm:items-center sm:gap-2">
                    <button
                      onClick={() => toggleTier(tier)}
                      className="flex w-full items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5 sm:hidden"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${config.badgeClass}`}
                        >
                          {config.label}
                        </span>
                        {selectedPlayer ? (
                          <span className="text-xs text-[#0a3d2a] dark:text-green-400 font-medium">
                            ✓ {selectedPlayer.name.split(" ").slice(-1)[0]}
                          </span>
                        ) : needsReplacement ? (
                          <span className="text-xs font-medium text-orange-500">
                            ⚠ Pick needed
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            Tap to select
                          </span>
                        )}
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {/* Desktop header */}
                    <div className="hidden sm:flex sm:items-center sm:gap-2">
                      <span
                        className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${config.badgeClass}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {config.description}
                      </span>
                      {needsReplacement && (
                        <span className="text-xs font-medium text-orange-500">
                          ⚠ Replacement needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Player cards */}
                  <div
                    className={`${isOpen ? "block" : "hidden"} sm:block sm:pt-1`}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {players.map((p) => {
                        const isSelected = selectedId === p.tournamentPlayerId;
                        return (
                          <button
                            key={p.tournamentPlayerId}
                            onClick={() =>
                              handleTierSelect(tier, p.tournamentPlayerId)
                            }
                            className={`flex items-center justify-between rounded-xl border-2 p-3 text-left transition ${
                              isSelected
                                ? `${config.cardClass} ring-2 ring-[#0a3d2a]/30`
                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <PlayerAvatar
                                name={p.name}
                                country={p.country}
                                photoUrl={p.photoUrl}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                                  {p.name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <Flag countryCode={p.country} size="sm" />
                                  {p.dataGolfRank && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      #{p.dataGolfRank}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="shrink-0 text-lg text-[#0a3d2a]">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile fixed submit bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {betaMode ? "Access: " : "Entry: "}
                  <span className="font-bold text-[#0a3d2a] dark:text-green-400">
                    {betaMode ? "Test Pass" : formatGBP(entryFee)}
                  </span>
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedCount}/5 selected
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={
                  !allTiersFilled || !teamName.trim() || submitting || showConfetti
                }
                className="shrink-0 rounded-full bg-[#0a3d2a] px-6 py-3 text-sm font-bold text-white shadow transition enabled:hover:bg-[#0a3d2a] disabled:cursor-not-allowed disabled:opacity-40 touch-target"
              >
                {submitting
                  ? "..."
                  : showConfetti
                    ? "✓"
                    : "Submit "}
              </button>
            </div>
          </div>

          {/* Desktop inline submit */}
          <div className="mt-8 hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 sm:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {betaMode ? "Beta access: " : "Entry fee: "}
                  <span className="font-bold text-[#0a3d2a] dark:text-green-400">
                    {betaMode ? "1 Test Pass · no payment" : formatGBP(entryFee)}
                  </span>
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedCount}/5 players selected
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={
                  !allTiersFilled || !teamName.trim() || submitting || showConfetti
                }
                className="rounded-full bg-[#0a3d2a] px-8 py-3 text-sm font-bold text-white shadow transition enabled:hover:bg-[#0a3d2a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "Submitting..."
                  : showConfetti
                    ? "✓ Done!"
                    : "Submit Team "}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
