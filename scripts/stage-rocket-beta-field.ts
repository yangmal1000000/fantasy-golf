import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  type FieldManifest,
  stageRocketBetaField,
} from "../src/lib/rocket-field-freeze";

const manifestPath = path.join(
  process.cwd(),
  "data",
  "rocket-classic-2026-field.provisional.json",
);
const mode = process.argv.includes("--freeze")
  ? "freeze"
  : process.argv.includes("--apply")
    ? "apply"
    : "dry-run";

async function main() {
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as FieldManifest;
  console.log(JSON.stringify(await stageRocketBetaField(manifest, mode), null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
