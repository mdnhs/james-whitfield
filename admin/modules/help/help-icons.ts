import {
  BookOpenIcon,
  CircleHelpIcon,
  GlobeIcon,
  InboxIcon,
  NewspaperIcon,
  SearchCheckIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type { HelpGroupId } from "@/lib/admin/help/registry"

// One icon per docs group, matching the sidebar's icon for that area.
export const HELP_GROUP_ICONS: Record<HelpGroupId, LucideIcon> = {
  start: BookOpenIcon,
  website: GlobeIcon,
  content: NewspaperIcon,
  inbox: InboxIcon,
  growth: SearchCheckIcon,
  settings: SettingsIcon,
  team: UsersIcon,
  faq: CircleHelpIcon,
}
