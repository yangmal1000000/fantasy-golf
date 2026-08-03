SET lock_timeout = '10s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION "preventFinalizedRocketTournamentMutation"()
RETURNS TRIGGER AS $$
DECLARE
  target_tournament_id TEXT;
BEGIN
  target_tournament_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."tournamentId"
    ELSE NEW."tournamentId"
  END;

  IF EXISTS (
    SELECT 1
    FROM "RocketBetaCampaign"
    WHERE "tournamentId" = target_tournament_id
      AND "finalizedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Finalized Rocket tournament data is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "preventFinalizedRocketSelectionMutation"()
RETURNS TRIGGER AS $$
DECLARE
  target_team_id TEXT;
BEGIN
  target_team_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."teamId"
    ELSE NEW."teamId"
  END;

  IF EXISTS (
    SELECT 1
    FROM "RocketBetaCampaign" AS campaign
    INNER JOIN "Team" AS team
      ON team."tournamentId" = campaign."tournamentId"
    WHERE team."id" = target_team_id
      AND campaign."finalizedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Finalized Rocket team selections are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "guardFinalizedRocketScore" ON "Score";
CREATE TRIGGER "guardFinalizedRocketScore"
BEFORE INSERT OR UPDATE OR DELETE ON "Score"
FOR EACH ROW EXECUTE FUNCTION "preventFinalizedRocketTournamentMutation"();

DROP TRIGGER IF EXISTS "guardFinalizedRocketTournamentPlayer" ON "TournamentPlayer";
CREATE TRIGGER "guardFinalizedRocketTournamentPlayer"
BEFORE INSERT OR UPDATE OR DELETE ON "TournamentPlayer"
FOR EACH ROW EXECUTE FUNCTION "preventFinalizedRocketTournamentMutation"();

DROP TRIGGER IF EXISTS "guardFinalizedRocketTeam" ON "Team";
CREATE TRIGGER "guardFinalizedRocketTeam"
BEFORE INSERT OR UPDATE OR DELETE ON "Team"
FOR EACH ROW EXECUTE FUNCTION "preventFinalizedRocketTournamentMutation"();

DROP TRIGGER IF EXISTS "guardFinalizedRocketTeamSelection" ON "TeamSelection";
CREATE TRIGGER "guardFinalizedRocketTeamSelection"
BEFORE INSERT OR UPDATE OR DELETE ON "TeamSelection"
FOR EACH ROW EXECUTE FUNCTION "preventFinalizedRocketSelectionMutation"();

DO $$
DECLARE
  installed_guard_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO installed_guard_count
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname IN (
      'guardFinalizedRocketScore',
      'guardFinalizedRocketTournamentPlayer',
      'guardFinalizedRocketTeam',
      'guardFinalizedRocketTeamSelection'
    );

  IF installed_guard_count <> 4 THEN
    RAISE EXCEPTION 'Expected four sealed Rocket mutation guards, found %',
      installed_guard_count;
  END IF;
END;
$$ LANGUAGE plpgsql;
