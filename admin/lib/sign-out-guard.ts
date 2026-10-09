"use client"

// Editors with unsaved work (the page builder's autosave) register a flush
// here. Sign-out runs them first, then blocks every later save, so nothing
// is sent once the session is being ended: a request after sign-out would
// only 401 and bounce the tab to the sign-in page mid-navigation.
type Flush = () => Promise<unknown>

const flushes = new Set<Flush>()
let signingOut = false

export const isSigningOut = () => signingOut

export function registerSignOutFlush(flush: Flush) {
  flushes.add(flush)
  return () => {
    flushes.delete(flush)
  }
}

// Bounded, so a hung save never keeps someone from signing out.
export async function prepareSignOut(timeout = 3000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    Promise.allSettled([...flushes].map((flush) => flush())),
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeout)
    }),
  ])
  clearTimeout(timer)
  signingOut = true
}

// Sign-out failed: the session goes on, and so does saving.
export function cancelSignOut() {
  signingOut = false
}
