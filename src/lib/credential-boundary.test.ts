import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const DATABASE_URL_WITH_PASSWORD =
  /postgres(?:ql)?:\/\/[^:\s"'`]+:[^@\s"'`]+@/i;
const THIS_TEST = "src/lib/credential-boundary.test.ts";

test("tracked source never contains a database URL with an embedded password", () => {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((file) => file !== THIS_TEST)
    .filter((file) => existsSync(file))
    .filter((file) => statSync(file).size < 2_000_000);

  const exposedFiles = trackedFiles.filter((file) => {
    const source = readFileSync(file, "utf8");
    return DATABASE_URL_WITH_PASSWORD.test(source);
  });

  assert.deepEqual(exposedFiles, []);
});
