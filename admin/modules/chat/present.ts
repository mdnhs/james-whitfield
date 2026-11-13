import { useSyncExternalStore } from "react"

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

const pad = (n: number) => String(n).padStart(2, "0")

// Today shows the time only; anything older "d MMM, HH:mm".
export function formatMessageTime(iso: string, now = new Date()) {
  const d = new Date(iso)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return today ? time : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`
}

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

// False while the tab is in the background.
export function useTabVisible() {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true
  )
}
