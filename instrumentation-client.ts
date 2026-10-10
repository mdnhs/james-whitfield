import * as z from "zod"

// Zod 4 probes `new Function("")` when the first z.object is constructed
// (node_modules/zod/v4/core/util.js `allowsEval`, read by schemas.js at
// construction). Under the CSP that probe is reported as a script-src
// violation on every page even though zod catches it (Ruling R14). Jitless
// mode skips the probe; parsing stays correct, only zod's JIT fast path
// (never available under our CSP anyway) is off. This file runs before the
// app's own modules (instrumentation-client.md: "polyfills").
z.config({ jitless: true })
