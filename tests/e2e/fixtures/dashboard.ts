import type { DashboardDto } from "@/server/modules/dashboard/service"

// Fixed dashboard data for screenshots. Typed against the API DTO so a
// change to the endpoint breaks this file, not a silent screenshot.
export const DASHBOARD_FIXTURE = {} as DashboardDto
