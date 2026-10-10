// brief §10.2: the draft applied to the admin itself, inline on <html>.
// Inline style beats the published <style>, and the cleanup hands back to it.
export function applyLive(
  root: HTMLElement,
  decls: [string, string][]
): () => void {
  const set: string[] = []
  for (const [name, value] of decls) {
    if (!/^--[a-z][a-z0-9-]*$/.test(name)) continue
    root.style.setProperty(name, value)
    set.push(name)
  }
  return () => {
    for (const name of set) root.style.removeProperty(name)
  }
}
