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
const piiReveal = readFileSync(
  new URL("../app/api/admin/customers/[id]/pii/route.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../prisma/production-migrations/20260725162000_admin_operations_foundation.sql",
    import.meta.url,
  ),
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
  assert.match(customerLayout, /requireAdminCapability\("VIEW_CUSTOMERS"\)/);
  assert.doesNotMatch(customerLayout, /isAdminOwner/);
});

test("customer PII is masked by default and every reveal is owner-only and audited", () => {
  assert.match(listPage, /maskAdminEmail\(customer\.email\)/);
  assert.match(detailPage, /maskAdminEmail\(customer\.email\)/);
  assert.doesNotMatch(source, /name:\s*user\.name\?\.trim\(\)\s*\|\|\s*user\.email/);
  assert.match(detailPage, /hasAdminCapability\(actor\.role, "REVEAL_CUSTOMER_PII"\)/);
  assert.match(piiReveal, /required: "REVEAL_CUSTOMER_PII"/);
  assert.match(piiReveal, /adminAuditEvent\.create/);
  assert.match(piiReveal, /customer\.pii\.email\.revealed/);
  assert.doesNotMatch(piiReveal, /metadata:\s*\{[^}]*customer\.email/);
  assert.match(migration, /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AdminAuditEvent"/);
});
