import {
  createLoader,
  createParser,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server"

import { BOARD_STATUSES } from "@/lib/leads/schema"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The open drawer's lead; anything that is not a uuid is no lead at all.
const parseAsUuid = createParser<string>({
  parse: (value) => (UUID.test(value) ? value.toLowerCase() : null),
  serialize: (value) => value,
})

// URL state for /admin/leads, so a notification email can deep-link into the
// drawer (`?lead=`) and a filtered view can be shared.
export const leadsParams = {
  view: parseAsStringLiteral(["board", "table"] as const).withDefault("board"),
  folder: parseAsStringLiteral(["inbox", "spam"] as const).withDefault("inbox"),
  status: parseAsStringLiteral(BOARD_STATUSES),
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  lead: parseAsUuid,
}

export const loadLeadsParams = createLoader(leadsParams)
