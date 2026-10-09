import { afterEach } from "vitest"

// Only jsdom files have a document; node-environment tests skip all of this.
if (typeof window !== "undefined") {
  // jsdom has no ResizeObserver; Base UI (scroll area, popups) and Recharts
  // expect one.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(async () => {
  if (typeof document === "undefined") return
  const { cleanup } = await import("@testing-library/react")
  cleanup()
})
