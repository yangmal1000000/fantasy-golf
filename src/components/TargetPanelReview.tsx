"use client";

import CourseMap from "@/app/target/CourseMap";
import {
  TARGET_SCENARIOS,
  formatTargetCoordinate,
} from "@/lib/target-challenge";
import type {
  TargetJudgeAssignmentDto,
  TargetJudgePhase,
  TargetOfficialTargetsRecord,
} from "@/lib/target-judge-core";

const MARKER_COLORS = ["#2563eb", "#9333ea", "#dc2626"];

export default function TargetPanelReview({
  assignments,
  phase,
  officialTargets,
}: {
  assignments: TargetJudgeAssignmentDto[];
  phase: TargetJudgePhase;
  officialTargets?: TargetOfficialTargetsRecord | null;
}) {
  return (
    <div className="space-y-8">
      {TARGET_SCENARIOS.map((scenario) => {
        const references = assignments.flatMap((assignment, index) => {
          const submission = phase === "initial"
            ? assignment.initialSubmission
            : assignment.finalSubmission;
          const mark = submission?.marks.find((item) => item.scenarioId === scenario.id);
          return mark
            ? [{
                point: mark.point,
                label: String(assignment.seat),
                color: MARKER_COLORS[index] ?? "#2563eb",
              }]
            : [];
        });
        const official = officialTargets?.targets.find(
          (target) => target.scenarioId === scenario.id,
        )?.point ?? null;

        return (
          <section
            key={scenario.id}
            className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="border-b border-zinc-100 p-5 dark:border-zinc-800">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Decision {scenario.number}
              </p>
              <h3 className="mt-1 text-xl font-black text-zinc-900 dark:text-white">
                {scenario.title}
              </h3>
            </div>
            <div className="bg-[#071f16] p-0 sm:p-5">
              <CourseMap
                scenario={scenario}
                point={official}
                referencePoints={references}
                compact
                edgeToEdgeOnMobile
              />
              {official ? (
                <p className="px-4 pb-4 pt-3 text-xs font-bold text-[#f4df9d] sm:px-0 sm:pb-0">
                  Gold pin = locked official target · numbered circles = judges
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 p-5 lg:grid-cols-3">
              {assignments.map((assignment, index) => {
                const submission = phase === "initial"
                  ? assignment.initialSubmission
                  : assignment.finalSubmission;
                const mark = submission?.marks.find((item) => item.scenarioId === scenario.id);
                return (
                  <article
                    key={assignment.id}
                    className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
                        style={{ backgroundColor: MARKER_COLORS[index] }}
                      >
                        {assignment.seat}
                      </span>
                      <div>
                        <p className="text-sm font-black text-zinc-900 dark:text-white">
                          {assignment.displayName}
                        </p>
                        <p className="text-[11px] text-zinc-500">{assignment.credential}</p>
                      </div>
                    </div>
                    {mark ? (
                      <>
                        <p className="mt-3 text-xs font-bold text-[#0a3d2a] dark:text-green-400">
                          {formatTargetCoordinate(mark.point.x)} · {formatTargetCoordinate(mark.point.y)}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                          {mark.rationale}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">Not submitted</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
