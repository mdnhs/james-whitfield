import {
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleDotIcon,
  PhoneOutgoingIcon,
  ShieldAlertIcon,
  type LucideIcon,
} from "lucide-react"

import { IconPill } from "@/admin/components/dashboard/icon-pill"
import type { LeadStatus } from "@/lib/leads/schema"

import { isLeadStatus, statusText, statusTone } from "./present"

export const LEAD_STATUS_ICONS: Record<LeadStatus, LucideIcon> = {
  new: CircleDotIcon,
  contacted: PhoneOutgoingIcon,
  booked: CalendarCheckIcon,
  closed: CircleCheckIcon,
  spam: ShieldAlertIcon,
}

// A lead's status as an icon pill; unknown values read as they are.
export function LeadStatusPill({ status }: { status: string }) {
  const known = isLeadStatus(status) ? status : "new"
  return (
    <IconPill tone={statusTone(known)} icon={LEAD_STATUS_ICONS[known]}>
      {statusText(status)}
    </IconPill>
  )
}
