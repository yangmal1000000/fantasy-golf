import assert from "node:assert/strict";
import test from "node:test";
import { safeRelativeRedirect } from "./auth-redirect";

test("keeps a same-origin path and query", () => {
  assert.equal(
    safeRelativeRedirect("/target?step=intro"),
    "/target?step=intro",
  );
});

test("rejects absolute, protocol-relative and backslash redirects", () => {
  assert.equal(safeRelativeRedirect("https://example.com"), "/");
  assert.equal(safeRelativeRedirect("//example.com"), "/");
  assert.equal(safeRelativeRedirect("/\\example.com"), "/");
});

test("rejects missing and control-character redirect values", () => {
  assert.equal(safeRelativeRedirect(null), "/");
  assert.equal(safeRelativeRedirect("/target\nSet-Cookie:test"), "/");
});
