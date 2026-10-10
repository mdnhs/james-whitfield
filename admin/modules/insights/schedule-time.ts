import { TZDate } from "@date-fns/tz"

const ZONE = "Europe/Dublin"
const pad = (n: number) => String(n).padStart(2, "0")

// <input type="datetime-local"> holds Dublin wall time (docs/brief.md §8.2).
export function dublinLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) throw new Error("Pick a date and time")
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  return new TZDate(y, mo - 1, d, h, mi, ZONE).toISOString()
}

export function isoToDublinLocal(iso: string): string {
  const t = new TZDate(new Date(iso).getTime(), ZONE)
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
}

const DUBLIN_TIME = new Intl.DateTimeFormat("en-IE", {
  hour: "2-digit",
  minute: "2-digit",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONE,
})

// Admin timestamps are shown in Dublin time (docs/brief.md §8.2).
export const formatDublin = (iso: string) => DUBLIN_TIME.format(new Date(iso))
