// server/modules/chat/crisis.ts
// Pure: the fixed crisis notice is sent by the server, never left to the model.
const CRISIS =
  /\b(?:suicid(?:e|al)|kill(?:ing)?\s+my\s?self|hurt(?:ing)?\s+my\s?self|end(?:ing)?\s+my\s+life|take\s+my\s+own\s+life|end\s+it\s+all|self[\s-]?harm(?:ing|ed)?|overdos(?:e|ed|es|ing)|want(?:ing)?\s+to\s+(?:die|be\s+dead))\b/i

export const isCrisis = (text: string) => CRISIS.test(text)
