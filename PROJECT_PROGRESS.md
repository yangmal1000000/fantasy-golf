# Stream 2: Tournaments List & Homepage — Progress Tracker

## Goal
Fix tournaments page filtering and homepage credibility issues.

## Architecture
- Project: /Users/harry/Projects/fantasy-golf-s2 (git worktree on branch `dev/tournaments-home`)
- Build: `npm install && npm run build`
- Main repo: /Users/harry/Projects/fantasy-golf (DO NOT touch — other streams working there)

## File Ownership (ONLY touch these)
- `src/app/tournaments/page.tsx`
- `src/app/page.tsx`
- `src/lib/ui.ts` (STATUS_CONFIG only)

## Tasks (do in order)

### T1: Tournaments page — default to upcoming/live, hide completed
- In `src/app/tournaments/page.tsx`, the page currently shows ALL tournaments chronologically
- Change default view: filter OUT completed tournaments (status === "completed")
- Show only: upcoming, entries_open, in_progress
- Add a "Show Past Events" toggle button at the top of the list
- This should be a client-side toggle — use a URL search param like `?past=1` or a simple client component
- Since the page is a server component, easiest approach: read `?past` from searchParams. Default = no past events. When user clicks "Show Past Events", link to `?past=1`
- Build must pass

### T2: Fix price inconsistency (£15 vs £10)
- In `src/app/page.tsx` homepage:
  - Hero says "Pay £15" in the "How It Works" section (the 3-column strip with Pick 5 / Pay £15 / Win)
  - But tournament entry fees are £10 (1000 pence)
  - Fix: change the "Pay £15" to dynamically reflect the most common entry fee, OR just say "Entry from £10"
  - Also fix JSON-LD structured data price from "15" to "10"
  - Also fix any remaining "£15" references in page.tsx
- Build must pass

### T3: Homepage — hide £0 prize pot when empty
- In `src/app/page.tsx`, the trust bar shows "£0.00 Prize Pot" when totalPot === 0
- When totalPot is 0, hide the prize pot span entirely or replace with something like "Free to preview"
- Better: if pot is 0, show number of tournaments with entries open instead
- Build must pass

### T4: Tournaments page — add status filter chips
- Add filter chips above the tournament list: "Upcoming" / "Live" / "All" (in addition to category filters already there)
- Default should be "Upcoming" (shows upcoming + entries_open + in_progress, hides completed)
- "Live" shows only in_progress
- "All" shows everything including completed
- These work alongside existing category and year filters
- Build must pass

## Rules
- ONLY work in /Users/harry/Projects/fantasy-golf-s2
- NEVER touch /Users/harry/Projects/fantasy-golf or other worktrees
- One task per run — implement, build, verify, update this file
- If build fails, fix it before marking task done
- After completing a task: `git add -A && git commit -m "<message>"` in this worktree
- Update this file: move task to Completed, update Next Action

## Completed

### T1: Tournaments page — default to upcoming/live, hide completed ✅
- Added `past` search param to page's searchParams type
- Completed tournaments filtered out by default (when `past` not `1`)
- "Show Past Events (N)" / "Hide Past Events" toggle button added above list
- Past state preserved across tour/category/year filter navigation via `buildHref` param
- Commit: `27e3b7f`
- Note: Build has pre-existing prerender failure on `/contact` (missing Supabase env vars) — unrelated, TypeScript compiles clean

## Next Action
T2: Fix price inconsistency (£15 vs £10) on homepage
