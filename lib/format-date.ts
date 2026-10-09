const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const dublin = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

const ordinal = (day: number) => {
  if (day % 100 >= 11 && day % 100 <= 13) return "th"
  return ["th", "st", "nd", "rd"][day % 10] ?? "th"
}

// "2nd Sep, 2026". Month names are fixed: ICU's en-IE short month for
// September is "Sept", which would change every label.
export function articleDate(date: Date) {
  const parts = Object.fromEntries(
    dublin.formatToParts(date).map((p) => [p.type, p.value])
  )
  const day = Number(parts.day)
  const month = Number(parts.month)
  return {
    iso: `${parts.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    label: `${day}${ordinal(day)} ${MONTHS[month - 1]}, ${parts.year}`,
  }
}
