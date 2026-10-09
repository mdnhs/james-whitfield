import "server-only"

import { tz } from "@date-fns/tz"
import { addDays, format, startOfWeek, subDays } from "date-fns"

// Dashboard weeks are Irish weeks: Monday 00:00 Europe/Dublin, so a sign-in
// at 00:30 on a Monday in summer (23:30 UTC Sunday) counts for Monday.
export const DUBLIN = tz("Europe/Dublin")

export type WeekDay = { key: string; label: string }

const plain = (date: Date) => new Date(date.getTime())

function daysFrom(start: Date): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index, { in: DUBLIN })
    return {
      key: format(day, "yyyy-MM-dd", { in: DUBLIN }),
      label: format(day, "EEE", { in: DUBLIN }),
    }
  })
}

export function weekWindow(now: Date) {
  const start = startOfWeek(now, { weekStartsOn: 1, in: DUBLIN })
  const previousStart = subDays(start, 7, { in: DUBLIN })
  return {
    start: plain(start),
    end: plain(addDays(start, 7, { in: DUBLIN })),
    previousStart: plain(previousStart),
    days: daysFrom(start),
    previousDays: daysFrom(previousStart),
  }
}
