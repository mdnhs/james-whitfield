import { readdir } from "node:fs/promises"
import path from "node:path"

const root = path.join(import.meta.dirname, "../..")

// Public-site component sources, relative to the repo root. components/ui is
// shadcn's (shared with the admin), not site content.
export async function siteSources() {
  const files: string[] = ["app/global-not-found.tsx"]
  for (const dir of ["features", "components", "app/(site)"]) {
    const entries = await readdir(path.join(root, dir), { recursive: true })
    for (const entry of entries) {
      const file = path.join(dir, entry)
      if (!file.endsWith(".tsx") || file.endsWith(".test.tsx")) continue
      if (file.startsWith(path.join("components", "ui"))) continue
      files.push(file)
    }
  }
  return files
}
