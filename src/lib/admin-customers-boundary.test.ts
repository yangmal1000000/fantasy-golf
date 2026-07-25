import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./admin-customers.ts", import.meta.url),
  "utf8",
);
const listPage = readFileSync(
  new URL("../app/admin/customers/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = readFileSync(
  new URL("../app/admin/customers/[id]/page.tsx", import.meta.url),
  "utf8",
);
const customerLayout = readFileSync(
  new URL("../app/admin/customers/layout.tsx", import.meta.url),
  "utf8",
);
const middleware = readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8",
);

test("Customer V1 stays read-only and does not expose draft payloads", () => {
  for (const mutation of [".create(", ".update(", ".upsert(", ".delete(", ".deleteMany("]) {
    assert.equal(source.includes(mutation), false, `unexpected mutation: ${mutation}`);
  }
  assert.match(source, /draftUpdatedAt/);
  assert.doesNotMatch(listPage, /draftTeam/);
  assert.doesNotMatch(detailPage, /draftTeam/);
  assert.doesNotMatch(listPage, /method=["']POST/);
  assert.doesNotMatch(detailPage, /method=["']POST/);
});

test("Customer V1 requires both the edge admin allowlist and database admin role", () => {
  assert.match(middleware, /isAdminPortalUser\(verifiedEmail\)/);
  assert.match(customerLayout, /user\?\.isAdmin/);
  assert.doesNotMatch(customerLayout, /isAdminOwner/);
});
