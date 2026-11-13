import { NAV_ICONS } from "@/admin/components/shell/nav-icons"

// A section's sidebar icon for its PageHeader, by nav id ("media", "leads"…).
export function SectionIcon({ id }: { id: string }) {
  const Icon = NAV_ICONS[id]
  return Icon ? <Icon /> : null
}
