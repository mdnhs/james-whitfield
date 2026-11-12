// server/modules/chat/crisis.ts
// Pure: the fixed crisis notice is sent by the server, never left to the model.
const CRISIS =
  /\b(?:suicid(?:e|al)|kill(?:ing)?\s+my\s?self(?![-\w])|hurt(?:ing)?\s+my\s?self(?![-\w])|end(?:ing)?\s+my\s+life(?![-\w])|take\s+my\s+own\s+life(?![-\w])(?!\s+back\b)|(?<!\bthe\s)end\s+it\s+all|self[\s-]?harm(?:ing|ed)?|overdos(?:e|ed|es|ing)|want(?:ing)?\s+to\s+(?:die|be\s+dead))\b/i

export const isCrisis = (text: string) => CRISIS.test(text)
