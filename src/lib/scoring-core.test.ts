import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFantasyScorePolicy,
  compareTeamScoreKeys,
  deriveCutLine,
  fantasyScoreState,
  sameTeamScorePosition,
} from "./scoring-core";

test("future rounds remain unscored instead of becoming zero", () => {
  const score = applyFantasyScorePolicy({
    scores: [68, null, null, null],
    par: 70,
    madeCut: null,
    withdrew: false,
  });
  assert.deepEqual(score.roundScores, [68, null, null, null]);
  assert.equal(score.totalStrokes, 68);
  assert.equal(score.roundsScored, 1);
  assert.equal(score.vsPar, -2);
  assert.equal(fantasyScoreState(score.roundsScored, 4), "PROVISIONAL");
});

test("cut line uses the 65th score and includes ties at that score", () => {
  const totals = Array.from({ length: 70 }, (_, index) => 130 + index);
  totals[65] = totals[64];
  const cutLine = deriveCutLine(totals);
  assert.equal(cutLine, 194);
  assert.equal(totals.filter((total) => total <= cutLine).length, 66);
  assert.equal(deriveCutLine(totals.slice(0, 64)), null);
});

test("missed-cut policy estimates only rounds three and four", () => {
  const score = applyFantasyScorePolicy({
    scores: [71, 73, null, null],
    par: 70,
    madeCut: false,
    withdrew: false,
  });
  assert.deepEqual(score.roundScores, [71, 73, 72, 72]);
  assert.deepEqual(score.isEstimated, [false, false, true, true]);
  assert.equal(score.totalStrokes, 288);
  assert.equal(score.vsPar, 8);
});

test("post-lock withdrawal always produces a deterministic four-round result", () => {
  const withOpeningRound = applyFantasyScorePolicy({
    scores: [74, null, null, null],
    par: 70,
    madeCut: null,
    withdrew: true,
  });
  assert.deepEqual(withOpeningRound.roundScores, [74, 74, 74, 74]);

  const withoutScore = applyFantasyScorePolicy({
    scores: [null, null, null, null],
    par: 70,
    madeCut: null,
    withdrew: true,
  });
  assert.deepEqual(withoutScore.roundScores, [80, 80, 80, 80]);
  assert.equal(withoutScore.vsPar, 40);
});

test("provisional ranking uses score to par and keeps unstarted teams last", () => {
  const throughTen = { totalStrokes: 345, vsPar: -5, roundsScored: 5 };
  const throughTwenty = { totalStrokes: 1396, vsPar: -4, roundsScored: 20 };
  const unstarted = { totalStrokes: 0, vsPar: 0, roundsScored: 0 };
  assert.ok(compareTeamScoreKeys(throughTen, throughTwenty) < 0);
  assert.ok(compareTeamScoreKeys(throughTwenty, unstarted) < 0);
  assert.equal(sameTeamScorePosition(throughTen, { ...throughTen }), true);
  assert.equal(sameTeamScorePosition(throughTen, throughTwenty), false);
});
