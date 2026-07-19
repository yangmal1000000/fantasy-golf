# Stream 1: Data & Players — Progress Tracker

## Goal
Fix data sync issues, player page defaults, and missing venue/tournament data.

## Architecture
- Project: /Users/harry/Projects/fantasy-golf-s1 (git worktree on branch `dev/data-players`)
- Build: `npm install && npm run build`
- Main repo: /Users/harry/Projects/fantasy-golf (DO NOT touch — other streams working there)

## File Ownership (ONLY touch these)
- `src/app/players/PlayersTable.tsx`
- `src/app/players/page.tsx`
- `src/lib/data-sync.ts`
- `src/app/api/sync/*/route.ts`
- `prisma/schema.prisma`

## Tasks (do in order)

### T1: Players page default filter → "All"
- In `src/app/players/PlayersTable.tsx`, change `useState<string>("ranked")` to `useState<string>("all")`
- Build must pass

### T2: Fix 9 ESPN tournament name mismatches
- In `src/lib/data-sync.ts`, find `syncTournamentResults` function
- It tries to match tournament names to ESPN events — 9 fail (The Masters, Chevron Championship, Mexico Open, Wells Fargo, Byron Nelson, Rocket Mortgage, Charles Schwab, KPMG Women's PGA, U.S. Women's Open)
- Add a name normalization map at the top of the ESPN matching logic: map our tournament names to ESPN's event names
- Look at how the function searches ESPN — it likely does a substring or exact match. Add aliases.
- Build must pass

### T3: Fix missing venue data for TBD tournaments
- Several completed tournaments show "TBD" as course (AT&T Pebble Beach, Puerto Rico Open, Texas Children's Houston Open)
- Add a static course data map in data-sync.ts with known course names for common PGA Tour events
- Add an endpoint `POST /api/sync/fix-venues` that fills in null/empty course fields from this map
- Build must pass

### T4: Add course yardage and architect fields to schema + sync
- Add `yardage Int?`, `architect String?`, `courseLocation String?` to Tournament model in prisma/schema.prisma
- Run `npx prisma generate` (DO NOT run migrations — Supabase pooler won't connect locally)
- Add yardage/architect data to the static course map from T3
- Extend `fix-venues` endpoint to also fill these fields
- Build must pass

## Rules
- ONLY work in /Users/harry/Projects/fantasy-golf-s1
- NEVER touch /Users/harry/Projects/fantasy-golf or other worktrees
- One task per run — implement, build, verify, update this file
- If build fails, fix it before marking task done
- After completing a task: `git add -A && git commit -m "<message>"` in this worktree
- Update this file: move task to Completed, update Next Action

## Completed
(empty)

## Next Action
T1: Players page default filter → "All"
