import {
  CircleHelpIcon,
  GlobeIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  HouseIcon,
  ImageIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MailIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  PanelsTopLeftIcon,
  RouteIcon,
  ScaleIcon,
  SearchCheckIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { createElement, type ReactNode } from "react"

// Icons live with the UI; lib/admin/nav.ts stays free of React.
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  website: GlobeIcon,
  media: ImageIcon,
  leads: InboxIcon,
  chat: MessagesSquareIcon,
  newsletter: MailIcon,
  seo: SearchCheckIcon,
  marketing: MegaphoneIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  activity: HistoryIcon,
  help: CircleHelpIcon,
}

// The Website sub-pages, keyed by their nav id. The same icon leads the
// sub-nav item and the page's own title.
export const SUBNAV_ICONS: Record<string, LucideIcon> = {
  "website-home": HouseIcon,
  "website-about": UserRoundIcon,
  "website-services": HeartHandshakeIcon,
  "website-how-it-works": RouteIcon,
  "website-contact": MailIcon,
  "website-insights": NewspaperIcon,
  "website-legal": ScaleIcon,
  "website-header-footer": PanelsTopLeftIcon,
}

// The icon of the Website screen an href belongs to (a service's editor
// under Services, an article under Insights), drawn for a page title.
export function websiteIcon(href: string): ReactNode {
  const path = href.split(/[?#]/)[0] ?? ""
  const segment = path.match(/^\/admin\/website\/([^/]+)/)?.[1]
  const Icon = path.startsWith("/admin/insights")
    ? NewspaperIcon
    : segment
      ? SUBNAV_ICONS[`website-${segment}`]
      : undefined
  return Icon ? createElement(Icon) : null
}
