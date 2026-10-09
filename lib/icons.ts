// Content icons, by name. Block schemas and the admin icon picker use this
// list; components/icons/content-icons.tsx holds the drawings.
export const ICON_NAMES = [
  "shield",
  "mind",
  "brain",
  "lock",
  "evidence",
  "control",
  "real-life",
  "anxiety",
  "confidence",
  "performance",
  "habits",
  "sleep",
  "workplace",
  "email",
  "phone",
  "clinic",
  "hours",
] as const

export type IconName = (typeof ICON_NAMES)[number]
