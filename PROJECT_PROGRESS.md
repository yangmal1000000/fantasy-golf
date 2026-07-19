# Stream 3: Tournament Detail & Leaderboard — Progress Tracker

## Goal
Fix the tournament detail page and restore the leaderboard/scoreboard for completed events.

## Architecture
- Project: /Users/harry/Projects/fantasy-golf-s3 (git worktree on branch `dev/tournament-detail`)
- Build: `npm install && npm run build`
- Main repo: /Users/harry/Projects/fantasy-golf (DO NOT touch — other streams working there)

## File Ownership (ONLY touch these)
- `src/app/tournaments/[id]/page.tsx`
- `src/app/tournaments/[id]/leaderboard/page.tsx`
- `src/app/tournaments/[id]/leaderboard/LeaderboardRefresh.tsx`

## Tasks (do in order)

### T1: Fix empty leaderboard for completed tournaments
- The leaderboard page at `/tournaments/[id]/leaderboard` shows "0 Teams, No teams yet" even for completed tournaments with real scores
- The issue: leaderboard depends on TEAMS (user entries) existing. No users = no teams = empty leaderboard
- Fix: when no teams exist, show the REAL PGA TOUR LEADERBOARD instead — the actual player scores from the Score table
- Create a "Tournament Leaderboard" section that shows ALL players in the field sorted by total strokes (R1-R4, total, to par)
- Show: position, player name, country, R1 R2 R3 R4, total, to par
- Highlight the winner (position 1)
- This is the "scoreboard" that was missing
- Top 20 shown by default, "Show Full Field" button to expand
- Build must pass

### T2: Tournament detail — add course profile section
- In `src/app/tournaments/[id]/page.tsx`, add a "Course Profile" section below the header
- Show: course name, par, yardage (if available in schema — if field doesn't exist, skip gracefully), location
- Display as an info card with a map pin icon
- If data not available, show "Course details TBA"
- Build must pass

### T3: Tournament detail — add winner card for completed events
- In `src/app/tournaments/[id]/page.tsx`, for completed tournaments:
  - Query the Score table to find the player with the lowest total strokes
  - Display a "Winner" card with: trophy icon, player name, country flag, total score, to par
  - Show runner-up too (2nd place)
- Build must pass

### T4: Tournament detail — add cut line info
- For completed/in-progress tournaments:
  - Calculate or display the cut line (typically top 65 + ties after R2)
  - Show "Cut Line: +X" or "Made the Cut: N players"
- Build must pass

### T5: Tournament detail — improve field display for upcoming tournaments
- When a tournament has no linked players (field is empty):
  - Show a proper empty state: "Field will be announced closer to the event"
  - Don't render empty tier sections
- Build must pass

## Rules
- ONLY work in /Users/harry/Projects/fantasy-golf-s3
- NEVER touch /Users/harry/Projects/fantasy-golf or other worktrees
- One task per run — implement, build, verify, update this file
- If build fails, fix it before marking task done
- After completing a task: `git add -A && git commit -m "<message>"` in this worktree
- Update this file: move task to Completed, update Next Action

## Completed
- **T1**: Fix empty leaderboard for completed tournaments — Created `TournamentLeaderboard.tsx` client component that shows real PGA Tour player scores sorted by total strokes. Shows top 20 with "Show Full Field" toggle, winner highlighted with gold + trophy. Responsive desktop table + mobile cards. Integrated into leaderboard page when no fantasy teams exist.

## Next Action
T2: Tournament detail — add course profile section
