import { execSync } from "node:child_process"

// Every run starts from a freshly migrated and seeded E2E database.
export default function globalSetup() {
  execSync("pnpm e2e:seed", { stdio: "inherit" })
}
