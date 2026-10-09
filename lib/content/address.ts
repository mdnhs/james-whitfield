type Address = {
  lines: string[]
  city: string
  eircode: string
  country: string
}

export const formatAddress = (address: Address) =>
  [...address.lines, address.eircode].filter(Boolean).join(", ")

export const clinicAddress = (address: Address) =>
  [formatAddress(address), address.country].filter(Boolean).join(" ")

// The directions link is derived, never stored (docs/brief.md §6.4).
export const mapsUrl = (address: Address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`
