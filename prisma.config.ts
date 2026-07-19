import { defineConfig } from "prisma/config";
import * as fs from "fs";

// Load .env.local manually
if (fs.existsSync(".env.local")) {
  const envLocal = fs.readFileSync(".env.local", "utf-8");
  for (const line of envLocal.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^"|"$/g, "");
      process.env[key] = val;
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for migrations (direct connection, not pooler)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"] || "file:./dev.db",
  },
});
