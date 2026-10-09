// The sidebar's count pill (the inspiration's "12+").
export const formatBadge = (count: number) =>
  count > 99 ? "99+" : String(count)
