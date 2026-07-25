import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8",
);
const operations = readFileSync(
  new URL("./admin-operations.ts", import.meta.url),
  "utf8",
);
const session = readFileSync(
  new URL("./admin-session.ts", import.meta.url),
  "utf8",
);
const middleware = readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../prisma/production-migrations/20260725162000_admin_operations_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const rocketField = readFileSync(
  new URL("./rocket-field-freeze.ts", import.meta.url),
  "utf8",
);

test("the admin cockpit is truthful and its monitoring path is read-only", () => {
  assert.match(dashboard, /Live operations cockpit/);
  assert.match(dashboard, /Source:/);
  assert.doesNotMatch(dashboard, /Revenue|formatGBP|DashboardActions/);
  for (const mutation of [
    ".create(",
    ".update(",
    ".upsert(",
    ".delete(",
    ".deleteMany(",
  ]) {
    assert.equal(
      operations.includes(mutation),
      false,
      `unexpected monitoring mutation: ${mutation}`,
    );
  }
  assert.match(session, /prisma\.user\.findUnique/);
  assert.doesNotMatch(session, /\.upsert\(/);
});

test("read-only admins cannot reach legacy controls or mutations", () => {
  assert.match(middleware, /quarantinedLegacyMutation/);
  assert.match(middleware, /canEdgeOperateAdmin\(verifiedEmail\)/);
  assert.match(migration, /'russglenn2@gmail\.com'/);
  assert.match(
    migration,
    /SET "adminRole" = 'READ_ONLY',[\s\S]*"isAdmin" = false/,
  );
});

test("admin audit history is append-only to the runtime role", () => {
  assert.match(
    migration,
    /GRANT SELECT, INSERT ON TABLE "AdminAuditEvent" TO fantasy_golf_app/,
  );
  assert.match(
    migration,
    /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AdminAuditEvent" FROM fantasy_golf_app/,
  );
});

test("the signed field endpoint never runs request-time schema DDL", () => {
  assert.doesNotMatch(rocketField, /ensureRocketBetaSchema/);
  assert.doesNotMatch(rocketField, /\$executeRaw/);
});
