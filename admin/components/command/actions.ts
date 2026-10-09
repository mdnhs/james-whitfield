import { matchesSearch } from "@/lib/search/normalize"

// Client-side actions in ⌘K (docs/brief.md §9.4). Navigation comes from the
// search API, so the server decides what each role may reach.
export type PaletteAction = {
  id: string
  label: string
  keywords: readonly string[]
  run: () => void
}

export function matchesQuery(
  q: string,
  label: string,
  keywords: readonly string[]
) {
  return matchesSearch(q, [label, ...keywords])
}

export function buildActions({
  setTheme,
  signOut,
  siteUrl,
}: {
  setTheme: (theme: string) => void
  signOut: () => void
  siteUrl: string
}): PaletteAction[] {
  return [
    {
      id: "theme-light",
      label: "Switch to light theme",
      keywords: ["appearance", "mode", "light"],
      run: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Switch to dark theme",
      keywords: ["appearance", "mode", "night"],
      run: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      label: "Use the system theme",
      keywords: ["appearance", "mode", "auto"],
      run: () => setTheme("system"),
    },
    {
      id: "open-site",
      label: "Open the live site",
      keywords: ["website", "view", "public"],
      run: () => window.open(siteUrl, "_blank", "noopener,noreferrer"),
    },
    {
      id: "sign-out",
      label: "Sign out",
      keywords: ["log out", "logout", "exit"],
      run: signOut,
    },
  ]
}
