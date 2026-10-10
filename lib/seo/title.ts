// Ruling R15: the one place the final <title> is decided, so the uniqueness
// and length checks measure exactly what ships.
export type TitleSubject = {
  home: boolean
  title: string
  seoTitle: string | null
}
export type TitleDefaults = { titleTemplate: string; defaultTitle: string }

export function documentTitle(s: TitleSubject, d: TitleDefaults) {
  if (s.home) return s.seoTitle || d.defaultTitle || s.title
  const own = s.seoTitle || s.title
  return d.titleTemplate ? d.titleTemplate.replace("%s", own) : own
}
