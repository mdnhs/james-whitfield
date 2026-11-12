import {
  CircleHelpIcon,
  GlobeIcon,
  HistoryIcon,
  ImageIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MailIcon,
  MegaphoneIcon,
  SearchCheckIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

// Icons live with the UI; lib/admin/nav.ts stays free of React.
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  website: GlobeIcon,
  media: ImageIcon,
  leads: InboxIcon,
  newsletter: MailIcon,
  seo: SearchCheckIcon,
  marketing: MegaphoneIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  activity: HistoryIcon,
  help: CircleHelpIcon,
}
