import type { Config } from "drizzle-kit";

export default {
  schema: "./src/core/**/*.schema.ts",
  out: "./drizzle",
  driver: "better-sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/keplar.db",
  },
} satisfies Config;
