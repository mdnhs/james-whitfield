// Entry point for the Better Auth CLI (`pnpm auth:generate`), which needs an
// exported instance. The app always goes through getAuth().
import { buildAuth } from "./auth"

export const auth = buildAuth()
