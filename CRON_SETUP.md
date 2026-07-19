# Cron Job Setup — Fantasy Golf Data Sync

After deploying the app, set up these cron jobs to keep data in sync automatically.

## Option 1: Vercel Cron (Recommended)

Add to `vercel.json` in the project root:

```json
{
  "crons": [
    {
      "path": "/api/sync/live",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/sync/rankings",
      "schedule": "0 6 * * 1"
    },
    {
      "path": "/api/sync/schedule",
      "schedule": "0 6 1 * *"
    },
    {
      "path": "/api/sync/results",
      "schedule": "0 22 * * *"
    }
  ]
}
```

### What each job does

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/sync/live` | Every 5 min | Pulls live scores for any in-progress tournament |
| `/api/sync/rankings` | Weekly (Mon 6am) | Updates OWGR rankings and recalculates tiers |
| `/api/sync/schedule` | Monthly (1st, 6am) | Syncs PGA Tour schedule for the current year |
| `/api/sync/results` | Daily (10pm) | Syncs results for completed tournaments |

## Option 2: External Cron (if not on Vercel)

```bash
# Every 5 minutes — live scores during tournaments
*/5 * * * * curl -s -X POST https://fantasy-golf-phi.vercel.app/api/sync/live > /dev/null 2>&1

# Weekly (Monday 6am) — world rankings
0 6 * * 1 curl -s -X POST https://fantasy-golf-phi.vercel.app/api/sync/rankings > /dev/null 2>&1

# Monthly (1st of month, 6am) — tournament schedule
0 6 1 * * curl -s -X POST https://fantasy-golf-phi.vercel.app/api/sync/schedule > /dev/null 2>&1

# Daily (10pm) — tournament results for completed events
0 22 * * * curl -s -X POST https://fantasy-golf-phi.vercel.app/api/sync/results > /dev/null 2>&1
```

## Manual Sync

You can trigger any sync endpoint manually:

```bash
# Full sync sequence (run after deploy)
curl -X POST https://fantasy-golf-phi.vercel.app/api/sync/schedule
curl -X POST https://fantasy-golf-phi.vercel.app/api/sync/rankings
curl -X POST https://fantasy-golf-phi.vercel.app/api/sync/results

# Sync a specific tournament's results
curl -X POST "https://fantasy-golf-phi.vercel.app/api/sync/results?tournamentId=the-open"

# Sync live scores for a specific tournament
curl -X POST "https://fantasy-golf-phi.vercel.app/api/sync/live?tournamentId=the-open"
```

## Data Source

All data comes from ESPN's unofficial PGA Tour API:
- Schedule & leaderboards: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard`
- Rankings: `https://www.espn.com/golf/rankings`
